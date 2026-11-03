import { z } from "zod";
import { runStructured } from "@/lib/ai/provider";
import type { Resume } from "@/lib/resume/types";
import { dedupeKeywords, KEYWORD_RULES, KeywordSchema } from "./extract";
import { scoreResume } from "./score";
import type { DescriptionSource, Job, JobKeyword, LocationCheck } from "./types";

/**
 * Many Telegram posts are one-liners ("X is hiring Y, apply here"), so the job's details and where it is
 * based are only on its job page. Read the page for the full description and ATS keywords, and let the
 * model judge whether the candidate can take the job from where they are.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const PAGE_CHARS = 14000;
const FETCH_CONCURRENCY = 5;
const CHECK_BATCH = 3;
const CHECK_CONCURRENCY = 3;

type JobPage = { status: "ok"; text: string } | { status: "closed" | "unreachable" };

/** What a job page says: where the job is based, and the job's full description with its ATS keywords ("" / [] if the page doesn't show them). */
export interface PageRead {
  check: LocationCheck;
  description: string;
  keywords: JobKeyword[];
}

/** Only public http(s) hosts: links come from strangers' posts, so never fetch localhost or IP addresses. */
function isPublicUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return host.includes(".") && !host.endsWith(".local") && !host.endsWith("localhost") && !/^[\d.]+$|^\[|:/.test(host);
  } catch {
    return false;
  }
}

function htmlToText(html: string): string {
  const structured = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter((t) => t.includes("JobPosting"))
    .join("\n")
    .slice(0, 8000);
  const body = html
    .replace(/<(head|script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return [structured && `Structured data: ${structured}`, body].filter(Boolean).join("\n\n").slice(0, PAGE_CHARS);
}

async function fetchJobPage(url: string): Promise<JobPage> {
  let current = url;
  try {
    // Follow redirects by hand so every hop gets the public-host check.
    for (let hop = 0; hop < 6; hop++) {
      if (!isPublicUrl(current)) return { status: "unreachable" };
      const res = await fetch(current, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        current = new URL(next, current).toString();
        continue;
      }
      if (res.status === 404 || res.status === 410) return { status: "closed" };
      if (!res.ok) return { status: "unreachable" };
      const text = htmlToText(await res.text());
      return text.length < 200 ? { status: "unreachable" } : { status: "ok", text };
    }
  } catch {
    // Timeouts, DNS errors, TLS errors: treat as unreachable.
  }
  return { status: "unreachable" };
}

const ReadSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      workMode: z.string(),
      location: z.string(),
      eligible: z.enum(["yes", "no", "unknown"]),
      reason: z.string(),
      description: z.string(),
      keywords: z.array(KeywordSchema),
    }),
  ),
});

const READ_SYSTEM = `You read job pages for a candidate: what each job is, and whether it is open to the candidate given where and how they can work.

For each job you get its title, company, what its Telegram post said, and the text of its job page (which may start with structured JobPosting data). The page text may also be a description the candidate pasted.
Return for each job id:
- workMode: "Remote" | "Hybrid" | "On-site" | "" (unknown).
- location: where the job is based or who can apply, as the page says it (e.g. "Remote – worldwide", "Remote (USA)", "Toronto, Canada", "Remote – EMEA"). "" if not stated.
- eligible: "yes" if the candidate can take this job from where they are under their rules; "no" if the page rules them out (on-site or hybrid somewhere they exclude, remote limited to other countries or regions, or work authorization they don't have), or the page says the listing is closed / no longer accepting applications; "unknown" if the page doesn't say.
  Structured data saying applicants may be "Worldwide" counts, unless the page text restricts it further.
- reason: a few words, e.g. "Remote, worldwide", "Remote, US only", "Hybrid in Toronto", "Listing closed".
- description: this job's full description from the page as plain text: about the company and role, responsibilities, requirements, nice-to-haves, benefits, salary. Keep the page's wording; put a blank line between sections and start list items with "- ". Leave out navigation, cookie notices, other jobs, application-form fields and footers. "" when the page doesn't show this job's details (a job board index, a different job, a sign-in wall, an error page).
- keywords: ${KEYWORD_RULES}
  Take them from the description; [] when description is "".`;

function unknownRead(job: Job, reason: string, checkedAt: string, eligible: LocationCheck["eligible"] = "unknown"): PageRead {
  return {
    check: { eligible, workMode: job.workMode, location: job.location, reason, checkedAt },
    description: "",
    keywords: [],
  };
}

/** Read page texts already in hand (fetched, captured in the candidate's browser, or pasted). */
export async function readJobPages(
  items: { job: Job; text: string }[],
  candidateLocation: string,
  onBatch?: (count: number) => void,
): Promise<Map<string, PageRead>> {
  const checkedAt = new Date().toISOString();
  const out = new Map<string, PageRead>();
  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += CHECK_BATCH) batches.push(items.slice(i, i + CHECK_BATCH));
  const where = candidateLocation.trim() || "Anywhere, any work mode.";
  let nextBatch = 0;
  await Promise.all(
    Array.from({ length: CHECK_CONCURRENCY }, async () => {
      while (nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        const user = `<candidate_location>\n${where}\n</candidate_location>\n\n${batch
          .map(
            ({ job: j, text }) =>
              `<job id="${j.id}">\nTitle: ${j.title}\nCompany: ${j.company}\nPost said: ${[j.workMode, j.location].filter(Boolean).join(", ") || "nothing about location"}\n<page>\n${text.slice(0, PAGE_CHARS)}\n</page>\n</job>`,
          )
          .join("\n\n")}`;
        try {
          const result = await runStructured({ system: READ_SYSTEM, user, schema: ReadSchema, effort: "low" });
          for (const r of result.jobs) {
            if (!batch.some((b) => b.job.id === r.id)) continue;
            out.set(r.id, {
              check: { eligible: r.eligible, workMode: r.workMode, location: r.location, reason: r.reason, checkedAt },
              description: r.description.trim(),
              keywords: r.description.trim() ? dedupeKeywords(r.keywords) : [],
            });
          }
        } catch {
          // Leave the batch unread; the jobs stay listed as "not verified".
        }
        for (const { job } of batch) if (!out.has(job.id)) out.set(job.id, unknownRead(job, "Check failed", checkedAt));
        onBatch?.(batch.length);
      }
    }),
  );
  return out;
}

/** Fetch and read each job's page. Calls `onProgress` with the number of jobs done. */
export async function checkJobPages(
  jobs: Job[],
  candidateLocation: string,
  onProgress?: (done: number) => void,
): Promise<Map<string, PageRead>> {
  const checkedAt = new Date().toISOString();
  const out = new Map<string, PageRead>();
  const pages: { job: Job; text: string }[] = [];
  let done = 0;
  const report = () => onProgress?.(done);

  // 1. Fetch job pages.
  let nextFetch = 0;
  await Promise.all(
    Array.from({ length: FETCH_CONCURRENCY }, async () => {
      while (nextFetch < jobs.length) {
        const job = jobs[nextFetch++];
        const page = job.applyUrl ? await fetchJobPage(job.applyUrl) : ({ status: "unreachable" } as const);
        if (page.status === "ok") {
          pages.push({ job, text: page.text });
          continue;
        }
        out.set(
          job.id,
          page.status === "closed"
            ? unknownRead(job, "Listing closed", checkedAt, "no")
            : unknownRead(job, job.applyUrl ? "Couldn't open the job page" : "No job page link", checkedAt),
        );
        done++;
        report();
      }
    }),
  );

  // 2. Read the pages that opened, a few per model call.
  const read = await readJobPages(pages, candidateLocation, (count) => {
    done += count;
    report();
  });
  for (const [id, r] of read) out.set(id, r);
  return out;
}

/**
 * Store what the page said on the job: jobs the candidate can't take (or closed ones) are dismissed, and a
 * full description replaces the post's, with its keywords and base score. Returns whether the description changed.
 */
export function applyPageRead(job: Job, read: PageRead, base: Resume, source: DescriptionSource = "page"): boolean {
  const { check } = read;
  job.locationCheck = check;
  if (check.location) job.location = check.location;
  if (check.workMode) job.workMode = check.workMode;
  if (check.eligible === "no") job.status = "dismissed";
  if (!read.description || read.keywords.length < 3) return false;
  job.description = read.description;
  job.descriptionSource = source;
  job.keywords = read.keywords;
  job.baseScore = scoreResume(base, job.keywords).score;
  return true;
}
