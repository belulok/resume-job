import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultResume } from "@/lib/resume/default-resume";
import { normalizeResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/types";
import type { ApplicantProfile, Job, JobSettings, JobSummary, ScanState } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const ITEMS_DIR = path.join(JOBS_DIR, "items");
const SETTINGS_FILE = path.join(JOBS_DIR, "settings.json");
const STATE_FILE = path.join(JOBS_DIR, "state.json");
const PROFILE_FILE = path.join(JOBS_DIR, "profile.json");
const RESUME_FILE = path.join(DATA_DIR, "resume.json");
export const APPLY_LOG_DIR = path.join(JOBS_DIR, "apply-logs");

export const DEFAULT_SETTINGS: JobSettings = {
  sources: [],
  schedule: { enabled: true, time: "09:00" },
  lookbackDays: 3,
  field: "",
  location: "",
  minRelevance: 35,
  targetScore: 90,
  maxJobsPerScan: 15,
  extraFacts: "",
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Atomic write (tmp + rename) so a concurrent reader never sees half a file. */
async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

export async function readSettings(): Promise<JobSettings> {
  const s = await readJson<Partial<JobSettings>>(SETTINGS_FILE);
  return { ...DEFAULT_SETTINGS, ...s, schedule: { ...DEFAULT_SETTINGS.schedule, ...s?.schedule } };
}

export async function writeSettings(settings: JobSettings) {
  await writeJson(SETTINGS_FILE, settings);
}

export async function readState(): Promise<ScanState> {
  const s = await readJson<Partial<ScanState>>(STATE_FILE);
  return { cursors: {}, hashes: [], log: [], ...s };
}

let stateLock: Promise<unknown> = Promise.resolve();

/** Read-modify-write of the scan state, serialized so concurrent updates in this process don't overwrite each other. */
export function updateState(fn: (s: ScanState) => ScanState | void): Promise<ScanState> {
  const run = stateLock.then(async () => {
    const current = await readState();
    const next = fn(current) ?? current;
    next.log = next.log.slice(-80);
    next.hashes = next.hashes.slice(-5000);
    await writeJson(STATE_FILE, next);
    return next;
  });
  stateLock = run.catch(() => {});
  return run;
}

export function jobFile(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid job id");
  return path.join(ITEMS_DIR, `${id}.json`);
}

export async function getJob(id: string): Promise<Job | null> {
  return readJson<Job>(jobFile(id));
}

export async function saveJob(job: Job) {
  job.updatedAt = new Date().toISOString();
  await writeJson(jobFile(job.id), job);
}

export async function deleteJob(id: string) {
  await rm(jobFile(id), { force: true });
}

export async function listJobs(): Promise<JobSummary[]> {
  let files: string[] = [];
  try {
    files = (await readdir(ITEMS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const jobs = await Promise.all(files.map((f) => readJson<Job>(path.join(ITEMS_DIR, f))));
  return jobs
    .filter((j): j is Job => !!j)
    .map(({ resume, description, keywords, ...rest }) => {
      void resume;
      void description;
      return { ...rest, keywordCount: keywords.length };
    })
    .sort((a, b) => (b.source.postedAt ?? b.createdAt).localeCompare(a.source.postedAt ?? a.createdAt));
}

/** The base resume used for tailoring: the last one saved in the editor, else the template. */
export async function loadBaseResume(): Promise<Resume> {
  const saved = await readJson<{ resume?: unknown }>(RESUME_FILE);
  return saved?.resume ? normalizeResume(saved.resume) : structuredClone(defaultResume);
}

const EMPTY_PROFILE: ApplicantProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  linkedin: "",
  github: "",
  website: "",
  noticePeriod: "",
  salaryExpectation: "",
  workAuthorization: "",
  answers: [],
};

/** First guess at the profile, from the base resume's name and contact links. */
function profileFromResume(resume: Resume): ApplicantProfile {
  const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s);
  const [first = "", ...rest] = titleCase(resume.header.name.trim()).split(/\s+/);
  const profile = { ...EMPTY_PROFILE, firstName: first, lastName: rest.join(" ") };
  for (const c of resume.header.contacts) {
    const url = c.url ?? "";
    if (url.startsWith("mailto:") || /^\S+@\S+\.\S+$/.test(c.label)) profile.email ||= url.replace(/^mailto:/, "") || c.label;
    else if (/linkedin\.com/i.test(url + c.label)) profile.linkedin ||= url || c.label;
    else if (/github\.com/i.test(url + c.label)) profile.github ||= url || c.label;
    else if (/^\+?[\d\s()-]{7,}$/.test(c.label)) profile.phone ||= c.label;
    else if (url.startsWith("http")) profile.website ||= url;
  }
  return profile;
}

export async function readProfile(): Promise<ApplicantProfile> {
  const saved = await readJson<Partial<ApplicantProfile>>(PROFILE_FILE);
  return saved ? { ...EMPTY_PROFILE, ...saved } : profileFromResume(await loadBaseResume());
}

export async function writeProfile(profile: ApplicantProfile) {
  await writeJson(PROFILE_FILE, profile);
}

export function contentHash(...parts: string[]) {
  const norm = parts.join("|").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha1").update(norm).digest("hex").slice(0, 16);
}

export function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
