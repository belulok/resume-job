import { fetchNewMessages } from "@/lib/telegram/client";
import { extractJobs, fieldFromResume, looksLikeJob, type ExtractedJob } from "./extract";
import { scoreResume } from "./score";
import {
  contentHash,
  getJob,
  listJobs,
  loadBaseResume,
  localDate,
  readSettings,
  readState,
  saveJob,
  updateState,
} from "./store";
import { tailorResume } from "./tailor";
import type { Job, JobSettings, JobSource, ScanProgress, ScanResult } from "./types";
import { applyPageRead, checkJobPages } from "./verify";

const EXTRACT_BATCH = 10;
const EXTRACT_CONCURRENCY = 3;
const STALE_LOCK_MS = 60 * 60 * 1000;

function pidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function isScanRunning() {
  const { running } = await readState();
  if (!running) return false;
  const stale = Date.now() - Date.parse(running.startedAt) > STALE_LOCK_MS || !pidAlive(running.pid);
  return !stale;
}

async function progress(patch: Partial<ScanProgress>, log?: string) {
  await updateState((s) => {
    if (s.running) s.running = { ...s.running, ...patch };
    if (log) s.log.push(`${new Date().toISOString()} ${log}`);
  });
}

function jobId(source: JobSource, index: number, hash: string) {
  if (source.kind === "telegram") {
    return `tg_${source.chatId!.replace(/^-/, "m")}_${source.messageId}_${index}`;
  }
  return `manual_${hash}`;
}

function newJob(ex: ExtractedJob, source: JobSource, index: number, settings: JobSettings, baseScore: number): Job {
  // Reposts of the same role at the same company are one job.
  const hash = contentHash(ex.title, ex.company || ex.description.slice(0, 2000));
  const now = new Date().toISOString();
  return {
    id: jobId(source, index, hash),
    createdAt: now,
    updatedAt: now,
    source,
    hash,
    title: ex.title,
    company: ex.company,
    location: ex.location,
    workMode: ex.workMode,
    employmentType: ex.employmentType,
    salary: ex.salary,
    applyUrl: ex.applyUrl,
    applyContact: ex.applyContact,
    summary: ex.summary,
    description: ex.description,
    keywords: ex.keywords,
    baseScore,
    status: baseScore >= settings.minRelevance ? "queued" : "skipped",
  };
}

/** Tailor one stored job (also used for "Re-tailor" and pasted jobs). */
export async function tailorJob(id: string): Promise<Job | null> {
  const job = await getJob(id);
  if (!job) return null;
  const settings = await readSettings();
  job.status = "tailoring";
  job.error = undefined;
  await saveJob(job);
  let patch: Partial<Job>;
  try {
    const base = await loadBaseResume();
    const result = await tailorResume(base, job, {
      targetScore: settings.targetScore,
      extraFacts: settings.extraFacts,
    });
    const label = [job.title, job.company].filter(Boolean).join(" @ ");
    patch = {
      baseScore: scoreResume(base, job.keywords).score,
      resume: { ...result.resume, title: `${base.title} – ${label}`.slice(0, 120) },
      score: result.score,
      matched: result.matched,
      missing: result.missing,
      gaps: result.gaps,
      tailorNotes: result.notes,
      status: result.score >= settings.targetScore ? "ready" : "partial",
    };
  } catch (e) {
    patch = { status: "error", error: (e as Error).message };
  }
  // Save onto a fresh copy: the job may have changed while tailoring ran (apply bot progress, applied / dismissed).
  const fresh = (await getJob(id)) ?? job;
  if (fresh.status === "applied" || fresh.status === "dismissed") delete patch.status;
  Object.assign(fresh, patch);
  await saveJob(fresh);
  return fresh;
}

/** Create a job from pasted text (LinkedIn, email, …) and tailor it regardless of relevance. */
export async function createManualJob(text: string): Promise<Job> {
  const [ex] = (await extractJobs([{ id: 1, text, date: new Date().toISOString() }])).jobs;
  if (!ex) throw new Error("No job posting was found in that text.");
  const settings = await readSettings();
  const base = await loadBaseResume();
  const job = newJob(ex, { kind: "manual", postedAt: new Date().toISOString() }, 0, settings, 0);
  job.baseScore = scoreResume(base, job.keywords).score;
  job.descriptionSource = "pasted";
  job.status = "queued";
  await saveJob(job);
  return job;
}

/** Jobs left waiting by an interrupted scan would otherwise show as "tailoring" forever. */
async function releaseStuckJobs() {
  for (const summary of await listJobs()) {
    if (summary.source.kind !== "telegram" || (summary.status !== "queued" && summary.status !== "tailoring")) continue;
    const job = await getJob(summary.id);
    if (!job) continue;
    job.status = "new";
    await saveJob(job);
  }
}

/** Scan new messages, or with `days`, re-read the last N days (posts already seen are still skipped). */
export async function runScan(trigger: ScanProgress["trigger"], opts: { days?: number } = {}): Promise<ScanResult> {
  if (await isScanRunning()) throw new Error("A scan is already running.");
  const startedAt = new Date().toISOString();
  await updateState((s) => {
    s.running = { startedAt, pid: process.pid, trigger, phase: "connecting", message: "Connecting to Telegram…", done: 0, total: 0 };
    s.log.push(`${startedAt} scan started (${trigger}${opts.days ? `, last ${opts.days} days` : ""})`);
  });
  await releaseStuckJobs();

  const result: ScanResult = {
    finishedAt: "",
    messagesScanned: 0,
    jobsFound: 0,
    offField: 0,
    tailored: 0,
    ready: 0,
    errors: [],
  };
  try {
    const settings = await readSettings();
    if (!settings.sources.length) throw new Error("No Telegram groups selected. Pick groups on the Jobs page.");
    const state = await readState();
    const base = await loadBaseResume();
    const field = settings.field.trim() || fieldFromResume(base);

    // 1. Fetch new messages from every source.
    await progress({ phase: "fetching", message: "Reading Telegram groups…", total: settings.sources.length });
    const fetched = await fetchNewMessages(
      settings.sources,
      opts.days ? {} : state.cursors,
      opts.days ?? settings.lookbackDays,
      (src, i) => progress({ message: `Reading ${src.title}…`, done: i }),
    );

    const candidates: { source: JobSource; text: string; id: number; date: string }[] = [];
    const seen = new Set([...state.hashes, ...(await listJobs()).map((j) => j.hash)]);
    const newHashes: string[] = [];
    const cursors: Record<string, number> = {};
    for (const src of settings.sources) {
      const res = fetched.get(src.id);
      if (!res) continue;
      if (res.error) result.errors.push(`${src.title}: ${res.error}`);
      cursors[src.id] = Math.max(res.maxId, state.cursors[src.id] ?? 0);
      result.messagesScanned += res.messages.length;
      for (const m of res.messages) {
        if (!looksLikeJob(m.text)) continue;
        const h = contentHash(m.text);
        if (seen.has(h)) continue;
        seen.add(h);
        newHashes.push(h);
        candidates.push({
          id: m.id,
          text: m.text,
          date: m.date,
          source: { kind: "telegram", chatId: src.id, chatTitle: src.title, messageId: m.id, link: m.link, postedAt: m.date },
        });
      }
    }

    // 2. Extract job postings in the candidate's field + ATS keywords, per chat in batches.
    const created: Job[] = [];
    const batches: (typeof candidates)[] = [];
    for (const src of settings.sources) {
      const mine = candidates.filter((c) => c.source.chatId === src.id);
      for (let i = 0; i < mine.length; i += EXTRACT_BATCH) batches.push(mine.slice(i, i + EXTRACT_BATCH));
    }
    await progress({
      phase: "extracting",
      message: `Finding job posts (${candidates.length} candidate messages)…`,
      done: 0,
      total: batches.length,
    });
    let nextBatch = 0;
    let finished = 0;
    const extractWorker = async () => {
      while (nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        try {
          const extracted = await extractJobs(batch, { field, location: settings.location });
          result.offField += extracted.offField.length;
          const perMessage = new Map<number, number>();
          for (const ex of extracted.jobs) {
            const msg = batch.find((b) => b.id === ex.messageId)!;
            const index = perMessage.get(ex.messageId) ?? 0;
            perMessage.set(ex.messageId, index + 1);
            const job = newJob(ex, msg.source, index, settings, scoreResume(base, ex.keywords).score);
            // Mark as seen before awaiting, so a parallel batch can't save the same repost.
            if (seen.has(job.hash)) continue;
            seen.add(job.hash);
            if (await getJob(job.id)) continue;
            newHashes.push(job.hash);
            await saveJob(job);
            created.push(job);
          }
        } catch (e) {
          result.errors.push(`extraction: ${(e as Error).message}`);
        }
        await progress({ done: ++finished });
      }
    };
    await Promise.all(Array.from({ length: EXTRACT_CONCURRENCY }, extractWorker));
    result.jobsFound = created.length;

    // Commit cursors now so a tailoring failure doesn't cause a re-scan of the same messages.
    await updateState((s) => {
      s.cursors = { ...s.cursors, ...cursors };
      s.hashes.push(...newHashes);
    });

    // 3. Read each job's page: the full description and its keywords (posts are often one-liners, so
    //    low-fit jobs are read too), and where the job is based. Dismiss the ones the candidate can't take.
    const toCheck = created.filter((j) => j.status === "queued" || j.status === "skipped");
    await progress({
      phase: "checking",
      message: `Reading ${toCheck.length} job pages…`,
      done: 0,
      total: toCheck.length,
    });
    const reads = await checkJobPages(toCheck, settings.location, (done) => progress({ done }));
    for (const job of toCheck) {
      const read = reads.get(job.id);
      if (!read) continue;
      applyPageRead(job, read, base);
      if (job.status === "dismissed") result.offField++;
      else job.status = job.baseScore >= settings.minRelevance ? "queued" : "skipped";
      await saveJob(job);
    }

    // 4. Tailor the most relevant jobs; the rest stay listed for tailoring on demand.
    const relevant = created.filter((j) => j.status === "queued").sort((a, b) => b.baseScore - a.baseScore);
    const queue = relevant.slice(0, settings.maxJobsPerScan);
    for (const job of relevant.slice(settings.maxJobsPerScan)) {
      job.status = "new";
      await saveJob(job);
    }
    for (const [i, job] of queue.entries()) {
      await progress({
        phase: "tailoring",
        message: `Tailoring CV for ${job.title}${job.company ? ` @ ${job.company}` : ""}…`,
        done: i,
        total: queue.length,
      });
      const done = await tailorJob(job.id);
      if (done?.status === "ready" || done?.status === "partial") result.tailored++;
      if (done?.status === "ready") result.ready++;
      if (done?.status === "error") result.errors.push(`${job.title}: ${done.error}`);
    }
  } catch (e) {
    result.errors.push((e as Error).message);
  } finally {
    result.finishedAt = new Date().toISOString();
    await updateState((s) => {
      s.running = undefined;
      s.lastRunAt = result.finishedAt;
      s.lastRunDate = localDate();
      s.lastResult = result;
      s.log.push(
        `${result.finishedAt} scan finished: ${result.messagesScanned} messages, ${result.jobsFound} jobs, ` +
          `${result.offField} not a match, ${result.ready} ready` +
          (result.errors.length ? `, ${result.errors.length} errors` : ""),
      );
    });
  }
  return result;
}
