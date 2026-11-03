import type { Resume } from "@/lib/resume/types";

export type KeywordCategory = "skill" | "tool" | "domain" | "soft" | "title" | "other";

/** An ATS keyword extracted from a job description. weight 3 = required, 2 = important, 1 = nice to have. */
export interface JobKeyword {
  term: string;
  aliases: string[];
  weight: number;
  category: KeywordCategory;
}

export interface JobSource {
  kind: "telegram" | "manual";
  chatId?: string;
  chatTitle?: string;
  messageId?: number;
  link?: string;
  postedAt?: string;
}

export type JobStatus =
  | "queued" // relevant, waiting for tailoring
  | "tailoring"
  | "ready" // tailored resume reaches the target score
  | "partial" // tailored, but below target (gaps listed)
  | "skipped" // base resume too far from the job to be worth tailoring
  | "new" // relevant, but not tailored automatically (beyond Max/scan, or its scan was interrupted)
  | "error"
  | "applied"
  | "dismissed";

/** Where the job is based, read from its job page, and whether the candidate can take it from where they are. */
export interface LocationCheck {
  eligible: "yes" | "no" | "unknown";
  workMode: string;
  location: string;
  reason: string;
  checkedAt: string;
}

/** Where the job description came from. Missing = the Telegram post (often a one-liner). */
export type DescriptionSource = "post" | "page" | "pasted";

/** An auto-fill run of the apply bot (own-stagehand), as it reports back. */
export interface ApplicationRun {
  mode: "apply" | "read";
  /** waiting = the candidate must act in Chrome (bot check, sign-in); review = form filled, Submit is theirs. */
  state: "running" | "waiting" | "review" | "submitted" | "done" | "failed" | "stopped";
  message: string;
  pid?: number;
  /** Labels of fields left for the candidate. */
  needsYou?: string[];
  filled?: number;
  startedAt: string;
  updatedAt: string;
}

export interface SavedAnswer {
  question: string;
  answer: string;
}

/** Details application forms ask for, reused on every form. */
export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  linkedin: string;
  github: string;
  website: string;
  noticePeriod: string;
  salaryExpectation: string;
  /** e.g. "Malaysian citizen. Needs visa sponsorship to work in any other country." */
  workAuthorization: string;
  /** Answers given on earlier forms, reused when a form asks the same thing. */
  answers: SavedAnswer[];
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: JobSource;
  hash: string;

  title: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  salary: string;
  applyUrl: string;
  applyContact: string;
  summary: string;
  description: string;
  descriptionSource?: DescriptionSource;
  keywords: JobKeyword[];
  locationCheck?: LocationCheck;
  application?: ApplicationRun;

  status: JobStatus;
  error?: string;
  /** ATS score of the base resume (0–100). */
  baseScore: number;
  /** ATS score of the tailored resume (0–100). */
  score?: number;
  matched?: string[];
  missing?: string[];
  /** Keywords the AI could not add truthfully. */
  gaps?: string[];
  tailorNotes?: string;
  resume?: Resume;
}

export type JobSummary = Omit<Job, "resume" | "description" | "keywords"> & { keywordCount: number };

export interface TelegramSourceRef {
  id: string;
  title: string;
  username?: string;
  kind: "group" | "channel";
}

export interface JobSettings {
  sources: TelegramSourceRef[];
  schedule: { enabled: boolean; time: string };
  /** On the first scan of a chat, look back this many days. */
  lookbackDays: number;
  /** The candidate's line of work; scans keep only jobs in it. Empty = inferred from the base resume. */
  field: string;
  /** Where and how the candidate can work, e.g. "Malaysia, remote only". Empty = anywhere. */
  location: string;
  /** Base-resume score needed before a job is tailored automatically. */
  minRelevance: number;
  targetScore: number;
  maxJobsPerScan: number;
  /** True facts about the candidate that are not on the resume; the AI may use them. */
  extraFacts: string;
}

export interface ScanProgress {
  startedAt: string;
  pid: number;
  trigger: "manual" | "schedule" | "cli";
  phase: "connecting" | "fetching" | "extracting" | "checking" | "tailoring" | "done";
  message: string;
  done: number;
  total: number;
}

export interface ScanResult {
  finishedAt: string;
  messagesScanned: number;
  jobsFound: number;
  /** Job posts dropped because they don't match the candidate's field, level or location. */
  offField: number;
  tailored: number;
  ready: number;
  errors: string[];
}

export interface ScanState {
  lastRunAt?: string;
  /** Local date (YYYY-MM-DD) of the last completed scheduled-or-manual scan. */
  lastRunDate?: string;
  /** Highest message id processed per chat. */
  cursors: Record<string, number>;
  /** Content hashes of jobs already seen (dedupe across groups / reposts). */
  hashes: string[];
  running?: ScanProgress;
  lastResult?: ScanResult;
  log: string[];
}
