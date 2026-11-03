import { z } from "zod";
import { runStructured } from "@/lib/ai/provider";
import { stripRich } from "@/lib/resume/richtext";
import type { Resume } from "@/lib/resume/types";
import type { JobKeyword } from "./types";

export const KeywordSchema = z.object({
  term: z.string(),
  aliases: z.array(z.string()),
  weight: z.number(),
  category: z.enum(["skill", "tool", "domain", "soft", "title", "other"]),
});

const ExtractedJobSchema = z.object({
  messageId: z.number(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  workMode: z.string(),
  employmentType: z.string(),
  salary: z.string(),
  applyUrl: z.string(),
  applyContact: z.string(),
  summary: z.string(),
  description: z.string(),
  keywords: z.array(KeywordSchema),
});

const OffFieldSchema = z.object({
  messageId: z.number(),
  title: z.string(),
  reason: z.string(),
});

const ExtractSchema = z.object({ jobs: z.array(ExtractedJobSchema) });
const FieldExtractSchema = z.object({ jobs: z.array(ExtractedJobSchema), offField: z.array(OffFieldSchema) });

export type ExtractedJob = z.infer<typeof ExtractedJobSchema> & { keywords: JobKeyword[] };
export type OffFieldJob = z.infer<typeof OffFieldSchema>;

export interface ExtractResult {
  jobs: ExtractedJob[];
  /** Postings outside the candidate's field (only when a field is given). */
  offField: OffFieldJob[];
}

/** How to pick ATS keywords; shared with the job-page reader. */
export const KEYWORD_RULES = `12–30 ATS keywords an applicant tracking system would scan for in a resume for THIS job:
  hard skills, languages, frameworks, tools, platforms, methodologies, domain terms, certifications, the role title, and soft skills only when explicitly requested.
  Use the job's exact spelling for "term" (ATS matching is literal). "aliases": common variants that mean the same thing (e.g. "Node.js" → ["NodeJS", "Node"], "Amazon Web Services" ↔ "AWS", "CI/CD" → ["continuous integration"]). Keep aliases strict synonyms.
  weight: 3 = explicitly required / must-have, 2 = important or repeated, 1 = nice-to-have / bonus.
  Avoid generic words ("experience", "team", "work", "company", "years").`;

const EXTRACT_SYSTEM = `You read messages from Telegram job groups and extract job postings for an ATS-style resume matcher.

For each message that advertises one or more open positions, return one entry per position (a message listing 3 roles gives 3 entries with the same messageId). Ignore messages that are not job openings: chit-chat, people looking for work, courses, ads, scams, crypto pumps, "DM me for jobs" spam without a real role.

Fields (use "" when unknown, never guess):
- title: the role title as written (e.g. "Senior Backend Engineer").
- company, location (city/country), workMode ("Remote" | "Hybrid" | "On-site" | ""), employmentType ("Full-time", "Contract", "Internship", ...), salary (as written).
- applyUrl: application link if present; applyContact: email / @handle / phone to apply.
- summary: one sentence about the role.
- description: the full job description text from the message, cleaned of emoji clutter and hashtags but otherwise complete (responsibilities, requirements, benefits). Keep it in the original language.
- keywords: ${KEYWORD_RULES}`;

function criteriaPrompt(field: string, location: string) {
  const where = location
    ? `
<candidate_location>
${location}
</candidate_location>`
    : "";
  const locationRule = location
    ? `
- Location: the candidate must be able to take the job from where they are, as described above. It fails when the post requires on-site or hybrid work the description rules out, or remote work limited to other countries or regions, or to people with work authorization the candidate doesn't have. A post that doesn't say where or how the work is done passes.`
    : "";
  return `

The candidate only wants jobs that match:
<candidate_field>
${field}
</candidate_field>${where}
Put a posting in "jobs" only if it passes every check:
- Field: it is in this field, or a neighbouring role someone with this background would realistically apply for. A different tech stack or salary does not fail it; those are scored later. When the field fit is unclear, it passes.
- Level: it fails only when the field above rules out its seniority (e.g. "no internships or junior roles" rules out "Junior Developer", "Intern", "Graduate Trainee").${locationRule}
List each posting that fails in "offField" instead, with only its messageId, title and a few-word reason, and do not extract it.`;
}

/** Roles and skills from the resume, used as the candidate's field when none is set. */
export function fieldFromResume(resume: Resume): string {
  const lines: string[] = [];
  for (const section of resume.sections) {
    const skills = /skill/i.test(section.title);
    if (section.hidden || !(skills || /experience/i.test(section.title))) continue;
    for (const entry of section.entries) {
      for (const block of entry.blocks) {
        if (block.type === "title" || block.type === "text") lines.push(stripRich(block.text));
        else if (block.type === "bullets" && skills) lines.push(...block.items.map(stripRich));
      }
    }
  }
  return `The line of work shown by the candidate's CV (job titles, then skills):\n${lines.join("\n").slice(0, 1500)}`;
}

/** Extract job postings from messages. With `field` (and `location`), postings that don't match are returned in `offField` only. */
export async function extractJobs(
  messages: { id: number; text: string; date: string }[],
  opts: { field?: string; location?: string } = {},
): Promise<ExtractResult> {
  if (!messages.length) return { jobs: [], offField: [] };
  const user = messages
    .map((m) => `<message id="${m.id}" date="${m.date.slice(0, 10)}">\n${m.text.slice(0, 3500)}\n</message>`)
    .join("\n\n");
  const field = opts.field?.trim();
  const result = field
    ? await runStructured({
        system: EXTRACT_SYSTEM + criteriaPrompt(field, opts.location?.trim() ?? ""),
        user,
        schema: FieldExtractSchema,
        effort: "low",
      })
    : { ...(await runStructured({ system: EXTRACT_SYSTEM, user, schema: ExtractSchema, effort: "low" })), offField: [] };
  const ids = new Set(messages.map((m) => m.id));
  return {
    jobs: result.jobs
      .filter((j) => ids.has(j.messageId) && j.title.trim() && j.keywords.length >= 3)
      .map((j) => ({
        ...j,
        keywords: dedupeKeywords(j.keywords),
      })),
    offField: result.offField.filter((j) => ids.has(j.messageId)),
  };
}

export function dedupeKeywords(keywords: JobKeyword[]): JobKeyword[] {
  const seen = new Set<string>();
  return keywords
    .map((k) => ({ ...k, weight: Math.max(1, Math.min(3, Math.round(k.weight) || 1)) }))
    .filter((k) => {
      const key = k.term.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Cheap pre-filter so only job-looking messages reach the model. */
const JOB_HINTS = [
  /hiring|we.?re hiring|now hiring|looking for (an?|our)|join (our|the) team/i,
  /\b(job|jobs|vacanc|position|opening|role|career|recruit|headcount)/i,
  /requirement|qualification|responsibilit|must have|nice to have|experience (in|with)|years? of experience|\d\+? ?years?/i,
  /salary|rm ?\d|\$ ?\d|usd|myr|sgd|per month|\/month|k\/mo|compensation|benefit/i,
  /apply|send (your )?(cv|resume)|application|career page|jobstreet|linkedin\.com\/jobs|forms\.gle/i,
  /full.?time|part.?time|contract|intern|freelance|remote|hybrid|on.?site/i,
  /developer|engineer|programmer|designer|analyst|manager|lead|architect|devops|data scientist|product|qa\b/i,
  /kerja|jawatan|kosong|gaji|permohonan|syarat|kelayakan/i,
];

export function looksLikeJob(text: string): boolean {
  if (text.length < 120) return false;
  return JOB_HINTS.filter((re) => re.test(text)).length >= 3;
}
