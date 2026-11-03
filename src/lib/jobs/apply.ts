import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { runStructured } from "@/lib/ai/provider";
import { resumePlainText } from "./score";
import { APPLY_LOG_DIR, listJobs, loadBaseResume, readProfile, readSettings, writeProfile } from "./store";
import type { ApplicationRun, Job, SavedAnswer } from "./types";

/**
 * Applying runs in the apply bot (own-stagehand's `npm run apply`), in the candidate's own Chrome.
 * CV Studio supplies the answers and keeps track of each run; the bot never clicks Submit.
 */

export const FormFieldSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(["text", "email", "tel", "url", "number", "date", "textarea", "select", "radio", "checkbox", "checkboxes", "combobox", "file"]),
  label: z.string().max(500),
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(250),
});
export type FormField = z.infer<typeof FormFieldSchema>;

const AnswersSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
      source: z.enum(["profile", "saved", "resume", "written", "none"]),
    }),
  ),
});
export type FormAnswer = z.infer<typeof AnswersSchema>["answers"][number];

const ANSWER_SYSTEM = `You fill in a job application form for a candidate. Return an answer for every field id.

Use only facts from <profile>, <saved_answers>, <resume> and <extra_facts>. Never invent experience, years, numbers, dates, employers, degrees, salary or legal status.
- Name, email, phone, location, links, notice period, salary expectation, work authorization / visa sponsorship: from the profile (source "profile"). Location fields take the profile's city and country.
- A question with the same meaning as a saved answer: reuse that answer (source "saved").
- Facts the resume states, e.g. current employer, title, years of experience when the dates make it clear (source "resume").
- Open questions about motivation or experience ("Why do you want to join us?", "Tell us about a project…", a cover-letter text box): write a specific answer in the first person, 60–150 words, from the resume and the job description; no clichés, no claims the resume doesn't support (source "written"). Leave optional open questions you can't answer well empty.
- select, radio: the value must be exactly one of the field's options. checkboxes: options joined by "; ". checkbox: "true" or "false". combobox with options: one of them; without options: the text to type.
- file: "resume" for a resume / CV upload; "" for any other file (cover letter, transcript, …).
- Leave the value "" (source "none") for: consent, privacy, terms or "I certify / confirm …" boxes (the candidate ticks those themselves); diversity / demographic questions (gender, race, veteran, disability) unless a saved answer covers them; anything you can't answer truthfully from the facts.`;

/** Draft answers for a form's fields. Values for select-like fields are checked against their options. */
export async function answerForm(job: Job, fields: FormField[]): Promise<FormAnswer[]> {
  const [profile, settings] = await Promise.all([readProfile(), readSettings()]);
  const resume = job.resume ?? (await loadBaseResume());
  const { answers: saved, ...details } = profile;
  const user = [
    `<job>\nTitle: ${job.title}\nCompany: ${job.company}\n\n${job.description.slice(0, 8000)}\n</job>`,
    `<profile>\n${JSON.stringify(details, null, 1)}\n</profile>`,
    `<saved_answers>\n${saved.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n") || "none"}\n</saved_answers>`,
    `<resume>\n${resumePlainText(resume).slice(0, 8000)}\n</resume>`,
    `<extra_facts>\n${settings.extraFacts.trim() || "none"}\n</extra_facts>`,
    `<fields>\n${JSON.stringify(fields, null, 1)}\n</fields>`,
  ].join("\n\n");
  const result = await runStructured({ system: ANSWER_SYSTEM, user, schema: AnswersSchema, effort: "medium" });

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const byId = new Map(fields.map((f) => [f.id, f]));
  return result.answers.flatMap((a) => {
    const field = byId.get(a.id);
    if (!field) return [];
    if (field.options.length && ["select", "radio", "checkboxes", "combobox"].includes(field.kind) && a.value) {
      const wanted = field.kind === "checkboxes" ? a.value.split(/;\s*/) : [a.value];
      const matched = wanted.map((w) => field.options.find((o) => norm(o) === norm(w))).filter((o): o is string => !!o);
      if (!matched.length) return [{ ...a, value: "", source: "none" as const }];
      return [{ ...a, value: matched.join("; ") }];
    }
    return [a];
  });
}

/** Remember answers the candidate typed on a form, newest first, replacing earlier answers to the same question. */
export async function saveAnswers(answers: SavedAnswer[]) {
  const clean = answers
    .map((a) => ({ question: a.question.replace(/\s+/g, " ").trim(), answer: a.answer.trim() }))
    .filter((a) => a.question && a.answer);
  if (!clean.length) return;
  const profile = await readProfile();
  const key = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const fresh = new Set(clean.map((a) => key(a.question)));
  profile.answers = [...clean, ...profile.answers.filter((a) => !fresh.has(key(a.question)))].slice(0, 200);
  await writeProfile(profile);
}

function pidAlive(pid?: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A run whose bot process is gone without reporting back (crashed, killed) shows as stopped. */
export function liveRun(run?: ApplicationRun): ApplicationRun | undefined {
  if (!run || !["running", "waiting", "review"].includes(run.state) || pidAlive(run.pid)) return run;
  return { ...run, state: "stopped", message: "The apply bot stopped without finishing." };
}

export function botDir() {
  return process.env.APPLY_BOT_DIR || path.join(os.homedir(), "own-stagehand");
}

/** Start the apply bot for a job. It uses one Chrome profile, so only one run at a time. */
export async function launchBot(job: Job, mode: ApplicationRun["mode"], cvStudioUrl: string): Promise<ApplicationRun> {
  const dir = botDir();
  if (!existsSync(path.join(dir, "src", "apply.ts"))) {
    throw new Error(`Apply bot not found in ${dir}. Set APPLY_BOT_DIR in .env.local.`);
  }
  const busy = (await listJobs()).find((j) => j.id !== job.id && ["running", "waiting", "review"].includes(liveRun(j.application)?.state ?? ""));
  if (busy) throw new Error(`Chrome is busy with "${busy.title}". Finish or stop that one first.`);
  if (["running", "waiting", "review"].includes(liveRun(job.application)?.state ?? "")) {
    throw new Error("This job is already open in Chrome.");
  }

  mkdirSync(APPLY_LOG_DIR, { recursive: true });
  const log = openSync(path.join(APPLY_LOG_DIR, `${job.id}.log`), "w");
  const args = ["run", "apply", "--", job.id, ...(mode === "read" ? ["--read"] : [])];
  // A clean environment: the bot loads its own .env; Next's variables would leak into its Node process.
  const { PATH, HOME, USER, LANG, TMPDIR } = process.env;
  const env = { PATH, HOME, USER, LANG, TMPDIR, CV_STUDIO_URL: cvStudioUrl } as unknown as NodeJS.ProcessEnv;
  const child = spawn("npm", args, { cwd: dir, detached: true, stdio: ["ignore", log, log], env });
  child.unref();
  const now = new Date().toISOString();
  return { mode, state: "running", message: "Starting Chrome…", pid: child.pid, startedAt: now, updatedAt: now };
}

/** Stop a run (closes its Chrome window). */
export function stopBot(run?: ApplicationRun) {
  if (!run?.pid || !pidAlive(run.pid)) return;
  try {
    process.kill(-run.pid, "SIGTERM"); // the whole process group: npm, node and Chrome
  } catch {
    process.kill(run.pid, "SIGTERM");
  }
}
