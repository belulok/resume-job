"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, History, Loader2, Play, Trash2 } from "lucide-react";
import type { ApplicantProfile, JobSettings } from "@/lib/jobs/types";
import { Button, FieldLabel, cx, inputClass } from "../ui";
import { JobsHeader, timeAgo, useJobsData, when, type JobsResponse } from "./shared";
import { TelegramPanel } from "./TelegramPanel";

function ScanPanel({
  data,
  onSettings,
  onScan,
}: {
  data: JobsResponse;
  onSettings: (patch: Partial<JobSettings>) => void;
  onScan: (days?: number) => void;
}) {
  const { settings, scan } = data;
  const running = scan.running;
  const [days, setDays] = useState(30);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-indigo-600 text-white">
          <CalendarClock className="size-3.5" />
        </span>
        <h3 className="text-[13px] font-semibold text-zinc-900">Daily scan</h3>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={settings.schedule.enabled}
            onChange={(e) => onSettings({ schedule: { ...settings.schedule, enabled: e.target.checked } })}
          />
          Enabled
        </label>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        Every day at
        <input
          type="time"
          className="h-7 rounded-md border border-zinc-200 px-1.5 text-xs outline-none focus:border-indigo-400"
          value={settings.schedule.time}
          onChange={(e) => onSettings({ schedule: { ...settings.schedule, time: e.target.value } })}
        />
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-zinc-400">Next run</dt>
        <dd className="text-zinc-700">
          {!settings.schedule.enabled
            ? "off"
            : settings.sources.length
              ? when(scan.nextRunAt)
              : "after you connect Telegram and pick groups"}
        </dd>
        <dt className="text-zinc-400">Last run</dt>
        <dd className="text-zinc-700">
          {scan.lastRunAt ? timeAgo(scan.lastRunAt) : "never"}
          {scan.lastResult && (
            <span className="text-zinc-500">
              {" "}
              · {scan.lastResult.messagesScanned} msgs · {scan.lastResult.jobsFound} jobs
              {scan.lastResult.offField ? ` · ${scan.lastResult.offField} not a match` : ""} · {scan.lastResult.ready} ready
            </span>
          )}
        </dd>
      </dl>
      {scan.lastResult?.errors.length ? (
        <details className="mt-1.5 text-[11px] text-amber-700">
          <summary className="cursor-pointer">{scan.lastResult.errors.length} issue(s) in last run</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {scan.lastResult.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {running ? (
        <div className="mt-3 rounded-lg bg-indigo-50 p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-800">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="truncate">{running.message}</span>
          </div>
          {running.total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round((running.done / running.total) * 100)}%` }}
              />
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-indigo-600/80">
            {running.phase} · {running.done}/{running.total} · started {timeAgo(running.startedAt)}
          </p>
        </div>
      ) : (
        <>
          <Button variant="primary" className="mt-3 w-full" onClick={() => onScan()} disabled={!settings.sources.length}>
            <Play className="size-3.5" /> Scan now
          </Button>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-600">
            Re-scan the last
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
              className="h-7 w-14 rounded-md border border-zinc-200 px-1.5 text-xs outline-none focus:border-indigo-400"
            />
            days
            <Button size="sm" className="ml-auto" onClick={() => onScan(days)} disabled={!settings.sources.length}>
              <History className="size-3.5" /> Re-scan
            </Button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            Scan now reads only new messages. Re-scan reads older ones again; jobs you already have aren&apos;t duplicated.
          </p>
        </>
      )}
    </section>
  );
}

function MatchingPanel({
  settings,
  onSettings,
}: {
  settings: JobSettings;
  onSettings: (patch: Partial<JobSettings>) => void;
}) {
  const [field, setField] = useState(settings.field);
  const [location, setLocation] = useState(settings.location);
  const [facts, setFacts] = useState(settings.extraFacts);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs">
      <h3 className="mb-2.5 text-[13px] font-semibold text-zinc-900">Matching</h3>
      <div className="mb-3">
        <FieldLabel>My field</FieldLabel>
        <textarea
          rows={5}
          value={field}
          onChange={(e) => setField(e.target.value)}
          onBlur={() => field !== settings.field && onSettings({ field })}
          placeholder="Taken from your base CV. Override it, e.g. Software engineering: full-stack, backend, AI/LLM"
          className={cx(inputClass, "resize-y text-xs leading-relaxed")}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          Scans keep only jobs in this field. Sales, admin and other unrelated posts are skipped before tailoring.
        </p>
      </div>
      <div className="mb-3">
        <FieldLabel>Where I can work</FieldLabel>
        <textarea
          rows={3}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => location !== settings.location && onSettings({ location })}
          placeholder="e.g. Based in Malaysia. Remote only, open to worldwide or APAC. Leave empty for anywhere."
          className={cx(inputClass, "resize-y text-xs leading-relaxed")}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          Jobs you can&apos;t take from there (on-site elsewhere, US-only remote, …) are skipped. Posts that don&apos;t say where
          are kept, so check those before applying.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["targetScore", "Target %", 50, 100],
            ["minRelevance", "Min fit %", 0, 100],
            ["maxJobsPerScan", "Max/scan", 1, 50],
          ] as const
        ).map(([key, label, min, max]) => (
          <label key={key} className="text-[11px] text-zinc-500">
            {label}
            <input
              type="number"
              min={min}
              max={max}
              value={settings[key]}
              onChange={(e) => onSettings({ [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })}
              className={cx(inputClass, "mt-0.5 h-8 py-1")}
            />
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
        Jobs whose base-CV match is below <b>Min fit</b> are listed but not tailored automatically. Each scan tailors up to{" "}
        <b>Max/scan</b> jobs; the rest can be tailored with one click.
      </p>
      <div className="mt-3">
        <FieldLabel>Extra facts about me</FieldLabel>
        <textarea
          rows={4}
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          onBlur={() => facts !== settings.extraFacts && onSettings({ extraFacts: facts })}
          placeholder={"True things that aren't on your CV — the AI may use them.\ne.g. Used Claude API and GitHub Actions at Pixlr; built FastAPI services in side projects."}
          className={cx(inputClass, "resize-y text-xs leading-relaxed")}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          The AI never invents experience. Missing keywords you genuinely have? Add them here and re-tailor.
        </p>
      </div>
    </section>
  );
}

const PROFILE_FIELDS: [keyof Omit<ApplicantProfile, "answers" | "workAuthorization">, string, string][] = [
  ["firstName", "First name", ""],
  ["lastName", "Last name", ""],
  ["email", "Email", ""],
  ["phone", "Phone", "+60 …"],
  ["city", "City", "e.g. Kuching"],
  ["country", "Country", "Malaysia"],
  ["linkedin", "LinkedIn", "https://linkedin.com/in/…"],
  ["github", "GitHub", "https://github.com/…"],
  ["website", "Portfolio / website", "https://…"],
  ["noticePeriod", "Notice period", "e.g. 1 month"],
  ["salaryExpectation", "Expected salary", "e.g. USD 6,000/month, negotiable"],
];

/** Details the apply bot types into application forms, and answers saved from earlier forms. */
function ApplicationProfilePanel() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => setError("Couldn't load the profile."));
  }, []);

  const save = async (next: ApplicantProfile) => {
    setProfile(next);
    const res = await fetch("/api/jobs/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setError(res.ok ? null : ((await res.json().catch(() => ({}))).error ?? "Couldn't save."));
  };
  const edit = (patch: Partial<ApplicantProfile>) => profile && setProfile({ ...profile, ...patch });
  const commit = () => profile && save(profile);

  if (!profile) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-3.5 text-xs text-zinc-500 shadow-xs">
        {error ?? "Loading profile…"}
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs">
      <h3 className="text-[13px] font-semibold text-zinc-900">Application profile</h3>
      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
        What <b>Auto-fill application</b> types into forms. Open questions are answered from your tailored CV; anything it
        can&apos;t answer truthfully is left for you.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {PROFILE_FIELDS.map(([key, label, placeholder]) => (
          <label key={key} className="text-[11px] text-zinc-500">
            {label}
            <input
              value={profile[key]}
              placeholder={placeholder}
              onChange={(e) => edit({ [key]: e.target.value })}
              onBlur={commit}
              className={cx(inputClass, "mt-0.5 h-8 py-1")}
            />
          </label>
        ))}
      </div>
      <label className="mt-2 block text-[11px] text-zinc-500">
        Work authorization / visa
        <textarea
          rows={2}
          value={profile.workAuthorization}
          placeholder="e.g. Malaysian citizen. Needs visa sponsorship to work in any other country; remote from Malaysia needs none."
          onChange={(e) => edit({ workAuthorization: e.target.value })}
          onBlur={commit}
          className={cx(inputClass, "mt-0.5 resize-y text-xs leading-relaxed")}
        />
      </label>

      <div className="mt-4">
        <FieldLabel>Saved answers ({profile.answers.length})</FieldLabel>
        {profile.answers.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Answers you type on application forms yourself are saved here and reused when another form asks the same question.
          </p>
        ) : (
          <ul className="space-y-2">
            {profile.answers.map((a, i) => (
              <li key={`${a.question}-${i}`} className="rounded-lg border border-zinc-200 p-2">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-xs font-medium text-zinc-800">{a.question}</span>
                  <button
                    title="Forget this answer"
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                    onClick={() => save({ ...profile, answers: profile.answers.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={a.answer}
                  onChange={(e) =>
                    edit({ answers: profile.answers.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })
                  }
                  onBlur={commit}
                  className={cx(inputClass, "mt-1 resize-y text-xs leading-relaxed")}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}

export function JobSettingsView() {
  const { data, error, updateSettings, startScan } = useJobsData();
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <JobsHeader active="settings">
        {error && <span className="text-xs text-rose-600">{error}</span>}
        <Link
          href="/jobs"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-800 shadow-xs hover:bg-zinc-50"
        >
          <ArrowLeft className="size-3.5" /> Back to jobs
        </Link>
      </JobsHeader>
      {!data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl p-6">
            <h1 className="text-lg font-semibold text-zinc-900">Job settings</h1>
            <p className="mt-0.5 text-xs text-zinc-500">Telegram groups, the daily scan, how jobs are matched to your CV, and what goes into applications.</p>
            <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <TelegramPanel settings={data.settings} onSettings={updateSettings} />
                <ScanPanel data={data} onSettings={updateSettings} onScan={startScan} />
              </div>
              <MatchingPanel
                key={`${data.settings.field}|${data.settings.location}|${data.settings.extraFacts}`}
                settings={data.settings}
                onSettings={updateSettings}
              />
            </div>
            <div className="mt-4">
              <ApplicationProfilePanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
