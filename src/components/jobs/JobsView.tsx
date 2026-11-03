"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Briefcase,
  Check,
  CircleStop,
  ClipboardPaste,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  MapPin,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { exportPdf } from "@/lib/export/exporters";
import type { ApplicationRun, Job, JobStatus, JobSummary, LocationCheck } from "@/lib/jobs/types";
import { Button, cx, inputClass } from "../ui";
import { JobsHeader, timeAgo, useJobsData, type JobsResponse } from "./shared";

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-zinc-100 text-zinc-600" },
  tailoring: { label: "Tailoring…", className: "bg-indigo-50 text-indigo-700" },
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700" },
  partial: { label: "Below target", className: "bg-amber-50 text-amber-700" },
  skipped: { label: "Low fit", className: "bg-zinc-100 text-zinc-500" },
  new: { label: "Not tailored", className: "bg-zinc-100 text-zinc-600" },
  error: { label: "Error", className: "bg-rose-50 text-rose-700" },
  applied: { label: "Applied", className: "bg-sky-50 text-sky-700" },
  dismissed: { label: "Dismissed", className: "bg-zinc-100 text-zinc-400" },
};

const ELIGIBILITY: Record<LocationCheck["eligible"], { label: string; className: string }> = {
  yes: { label: "Open to you", className: "bg-emerald-50 text-emerald-700" },
  unknown: { label: "Location not verified", className: "bg-amber-50 text-amber-700" },
  no: { label: "Not open to you", className: "bg-rose-50 text-rose-700" },
};

function LocationNote({ check }: { check: LocationCheck }) {
  const text =
    check.eligible === "yes"
      ? `Open to you: ${check.reason} (from the job page).`
      : check.eligible === "no"
        ? `Not open to you: ${check.reason}.`
        : `Location not verified: ${check.reason}. Check the job page before applying.`;
  return <p className={cx("mt-3 rounded-lg p-2.5 text-xs", ELIGIBILITY[check.eligible].className)}>{text}</p>;
}

const RUN_STATE: Record<ApplicationRun["state"], { label: string; className: string }> = {
  running: { label: "Working in Chrome…", className: "border-indigo-200 bg-indigo-50/60 text-indigo-950" },
  waiting: { label: "Needs you in Chrome", className: "border-amber-200 bg-amber-50/70 text-amber-950" },
  review: { label: "Filled in: your turn", className: "border-emerald-200 bg-emerald-50/60 text-emerald-950" },
  submitted: { label: "Submitted", className: "border-sky-200 bg-sky-50/60 text-sky-950" },
  done: { label: "Job page read", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
  failed: { label: "Couldn't finish", className: "border-rose-200 bg-rose-50/60 text-rose-950" },
  stopped: { label: "Stopped", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
};

const runActive = (run?: ApplicationRun) => !!run && ["running", "waiting", "review"].includes(run.state);

/** What the apply bot is doing in Chrome for this job. */
function ApplicationPanel({ run, onStop }: { run: ApplicationRun; onStop: () => void }) {
  const meta = RUN_STATE[run.state];
  const active = runActive(run);
  return (
    <div className={cx("mt-3 rounded-xl border p-3 text-xs leading-relaxed", meta.className)}>
      <div className="flex items-center gap-2">
        {run.state === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
        <b className="font-semibold">{run.mode === "read" ? `Reading the job page · ${meta.label}` : meta.label}</b>
        <span className="opacity-60">· {timeAgo(run.updatedAt)}</span>
        {active && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onStop}>
            <CircleStop className="size-3.5" /> Stop
          </Button>
        )}
      </div>
      <p className="mt-1">{run.message}</p>
      {!!run.needsYou?.length && (
        <p className="mt-1.5">
          <b>Fill these yourself:</b> {run.needsYou.join(" · ")}
        </p>
      )}
      {run.state === "review" && (
        <p className="mt-1.5 opacity-80">
          Check every answer in the Chrome window, then click Submit there. This job is marked applied when the confirmation
          page shows, and answers you typed are saved for next time.
        </p>
      )}
    </div>
  );
}

function ScoreRing({ score, target, size = 44, muted }: { score: number; target: number; size?: number; muted?: boolean }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = muted ? "#a1a1aa" : score >= target ? "#10b981" : score >= target - 15 ? "#f59e0b" : "#f43f5e";
  return (
    <svg width={size} height={size} className="shrink-0" role="img" aria-label={`${score}% match`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f4f4f5" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${(c * score) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 3.6} fontWeight={700} fill="#18181b">
        {score}
      </text>
    </svg>
  );
}

function PasteDialog({
  title,
  hint,
  submitLabel,
  busyLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  hint: string;
  submitLabel: string;
  busyLabel: string;
  /** Throws to show an error and keep the dialog open. */
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-6" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <button className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        <textarea
          autoFocus
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={cx(inputClass, "mt-3 resize-y font-mono text-xs leading-relaxed")}
          placeholder="Paste the full job description here…"
        />
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || text.trim().length < 80}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSubmit(text);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardPaste className="size-3.5" />}
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

async function postJson(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

// ---------------------------------------------------------------------------

const FILTERS: { id: string; label: string; match: (j: JobSummary) => boolean }[] = [
  { id: "active", label: "Active", match: (j) => j.status !== "dismissed" && j.status !== "skipped" },
  {
    id: "open",
    label: "Open to you",
    match: (j) => j.locationCheck?.eligible === "yes" && j.status !== "dismissed" && j.status !== "skipped",
  },
  { id: "ready", label: "Ready ≥ target", match: (j) => j.status === "ready" },
  { id: "partial", label: "Below target", match: (j) => j.status === "partial" },
  { id: "skipped", label: "Low fit", match: (j) => j.status === "skipped" },
  { id: "applied", label: "Applied", match: (j) => j.status === "applied" },
  { id: "all", label: "All", match: () => true },
];

function JobRow({ job, target, active, onClick }: { job: JobSummary; target: number; active: boolean; onClick: () => void }) {
  const tailored = job.score !== undefined && job.status !== "skipped";
  const meta = STATUS_META[job.status];
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-500/15" : "border-zinc-200 bg-white hover:border-zinc-300",
      )}
    >
      {job.status === "tailoring" || job.status === "queued" ? (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-50">
          <Loader2 className="size-4 animate-spin text-indigo-500" />
        </div>
      ) : (
        <ScoreRing score={tailored ? job.score! : job.baseScore} target={target} muted={!tailored} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-900">{job.title}</span>
          <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", meta.className)}>{meta.label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="min-w-0 truncate">
            {[job.company, job.location, job.workMode].filter(Boolean).join(" · ") || "Company not stated"}
          </span>
          {job.locationCheck && (
            <span
              title={job.locationCheck.reason}
              className={cx("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", ELIGIBILITY[job.locationCheck.eligible].className)}
            >
              {ELIGIBILITY[job.locationCheck.eligible].label}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-zinc-400">
          {job.source.kind === "telegram" ? <Send className="size-3 shrink-0" /> : <ClipboardPaste className="size-3 shrink-0" />}
          <span className="truncate">{job.source.kind === "telegram" ? job.source.chatTitle : "Pasted"}</span>·
          <span className="shrink-0">{timeAgo(job.source.postedAt ?? job.createdAt)}</span>
          {tailored && <span className="shrink-0">· base {job.baseScore}%</span>}
        </div>
      </div>
    </button>
  );
}

function KeywordChips({ job }: { job: Job }) {
  const matched = new Set((job.matched ?? []).map((k) => k.toLowerCase()));
  const tailored = job.score !== undefined;
  const sorted = [...job.keywords].sort((a, b) => b.weight - a.weight);
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((k) => {
        const hit = matched.has(k.term.toLowerCase());
        return (
          <span
            key={k.term}
            title={`${k.category} · weight ${k.weight}${k.aliases.length ? ` · also: ${k.aliases.join(", ")}` : ""}`}
            className={cx(
              "rounded-full border px-2 py-0.5 text-[11px]",
              !tailored
                ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                : hit
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700",
              k.weight === 3 && "font-semibold",
            )}
          >
            {tailored && (hit ? "✓ " : "✗ ")}
            {k.term}
          </span>
        );
      })}
    </div>
  );
}

function JobDetail({
  summary,
  target,
  onChanged,
  onDeleted,
}: {
  summary: JobSummary;
  target: number;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [pastingDesc, setPastingDesc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/jobs/${summary.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && setJob(j));
    return () => {
      cancelled = true;
    };
  }, [summary.id, summary.updatedAt]);

  const patch = async (body: object) => {
    await fetch(`/api/jobs/${summary.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onChanged();
  };

  if (!job || job.id !== summary.id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
      </div>
    );
  }

  const tailored = job.score !== undefined && !!job.resume;
  const working = job.status === "queued" || job.status === "tailoring";
  const botBusy = runActive(job.application);
  const fromPost = !job.descriptionSource || job.descriptionSource === "post";
  const collapsed = !showDesc && (job.description.length > 900 || job.description.split("\n").length > 14);

  const startBot = async (mode: ApplicationRun["mode"]) => {
    try {
      await postJson(`/api/jobs/${job.id}/application`, { mode });
    } catch (e) {
      alert((e as Error).message);
    }
    onChanged();
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-zinc-900">{job.title}</h2>
          <p className="mt-0.5 text-sm text-zinc-600">{job.company || "Company not stated"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {[
              job.location && (
                <>
                  <MapPin className="size-3" /> {job.location}
                </>
              ),
              job.workMode,
              job.employmentType,
              job.salary,
            ]
              .filter(Boolean)
              .map((x, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                  {x}
                </span>
              ))}
          </div>
        </div>
        {working ? (
          <div className="flex flex-col items-center gap-1 text-[11px] text-indigo-600">
            <Loader2 className="size-8 animate-spin" /> tailoring…
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <ScoreRing score={job.baseScore} target={target} size={48} muted />
              <div className="mt-0.5 text-[10px] text-zinc-400">base CV</div>
            </div>
            {tailored && (
              <>
                <span className="text-zinc-300">→</span>
                <div className="text-center">
                  <ScoreRing score={job.score!} target={target} size={64} />
                  <div className="mt-0.5 text-[10px] font-medium text-zinc-600">tailored</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tailored && (
          // Full page load: the editor reads ?job= on mount.
           
          <a
            href={`/?job=${encodeURIComponent(job.id)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <PenLine className="size-3.5" /> Open tailored CV
          </a>
        )}
        {tailored && (
          <Button
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              await exportPdf(job.resume!).finally(() => setPdfBusy(false));
            }}
          >
            {pdfBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} PDF
          </Button>
        )}
        {!working && (
          <Button
            onClick={async () => {
              await fetch(`/api/jobs/${job.id}/tailor`, { method: "POST" });
              onChanged();
            }}
          >
            <RefreshCw className="size-3.5" /> {tailored ? "Re-tailor" : "Tailor CV"}
          </Button>
        )}
        {job.applyUrl && (
          <Button
            disabled={botBusy}
            onClick={() => startBot("apply")}
            title="Open the application in your Chrome and fill it in; you review and click Submit"
          >
            <Bot className="size-3.5" /> Auto-fill application
          </Button>
        )}
        {(job.applyUrl || job.source.link) && (
          <a
            href={job.applyUrl || job.source.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <ArrowUpRight className="size-3.5" /> {job.applyUrl ? "Job page" : "Open post"}
          </a>
        )}
        <div className="ml-auto flex gap-1">
          {job.status !== "applied" ? (
            <Button variant="ghost" size="sm" onClick={() => patch({ status: "applied" })}>
              <Check className="size-3.5" /> Mark applied
            </Button>
          ) : null}
          {job.status !== "dismissed" && (
            <Button variant="ghost" size="sm" onClick={() => patch({ status: "dismissed" })}>
              Dismiss
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete this job and its tailored CV?")) return;
              await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
              onDeleted();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {job.application && (
        <ApplicationPanel
          run={job.application}
          onStop={async () => {
            await fetch(`/api/jobs/${job.id}/application`, { method: "DELETE" });
            onChanged();
          }}
        />
      )}
      {job.locationCheck && <LocationNote check={job.locationCheck} />}
      {job.applyContact && (
        <p className="mt-3 text-xs text-zinc-600">
          <b>Apply via:</b> {job.applyContact}
        </p>
      )}
      {job.error && <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{job.error}</p>}

      {tailored && job.tailorNotes && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs leading-relaxed text-indigo-950">
          <b className="font-semibold">What changed: </b>
          {job.tailorNotes}
        </div>
      )}

      {tailored && (job.missing?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
          <b>Not on your CV:</b> {job.missing!.join(", ")}. If you genuinely have any of these, add them under
          <i> Extra facts about me</i> and click Re-tailor.
        </div>
      )}

      <h4 className="mb-1.5 mt-5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        ATS keywords ({job.keywords.length}) — bold = required
      </h4>
      <KeywordChips job={job} />

      <div className="mt-5 flex items-center gap-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Job description</h4>
        {job.source.kind === "telegram" && (
          <span className="text-[11px] text-zinc-400">
            · {fromPost ? "post in" : job.descriptionSource === "page" ? "from the job page · posted in" : "pasted · posted in"}{" "}
            {job.source.chatTitle}
            {job.source.link && (
              <a href={job.source.link} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-sky-600 hover:underline">
                open in Telegram <ExternalLink className="size-3" />
              </a>
            )}
          </span>
        )}
      </div>
      {fromPost && job.source.kind === "telegram" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs leading-relaxed text-amber-900">
          <span className="min-w-0 flex-1 basis-64">
            This is only the Telegram post. The job page couldn&apos;t be read automatically, so the keywords and tailored CV
            are based on this text.
          </span>
          {job.applyUrl && (
            <Button size="sm" disabled={botBusy} onClick={() => startBot("read")} title="Open the job page in your Chrome and read it">
              <FileSearch className="size-3.5" /> Read page in Chrome
            </Button>
          )}
          <Button size="sm" onClick={() => setPastingDesc(true)}>
            <ClipboardPaste className="size-3.5" /> Paste description
          </Button>
        </div>
      )}
      <div
        className={cx(
          "relative mt-1.5 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-700",
          collapsed && "max-h-60 overflow-hidden",
        )}
      >
        {job.description}
        {collapsed && (
          <button
            onClick={() => setShowDesc(true)}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent pb-2 pt-8 text-xs font-medium text-indigo-600"
          >
            Show full description
          </button>
        )}
      </div>
      {pastingDesc && (
        <PasteDialog
          title="Paste the full job description"
          hint="Copy it from the job page. The keywords are read from it and your CV is re-tailored."
          submitLabel="Use & re-tailor"
          busyLabel="Reading…"
          onClose={() => setPastingDesc(false)}
          onSubmit={async (text) => {
            const { updated } = await postJson(`/api/jobs/${job.id}/page`, { text, source: "pasted" });
            if (!updated) throw new Error("That doesn't look like this job's description. Paste the whole description.");
            setPastingDesc(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScanStatus({ scan, canScan, onScan }: { scan: JobsResponse["scan"]; canScan: boolean; onScan: () => void }) {
  if (scan.running) {
    const r = scan.running;
    return (
      <Link href="/jobs/settings" className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs text-indigo-700 hover:bg-indigo-50">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        <span className="truncate">{r.message}</span>
        {r.total > 0 && (
          <span className="shrink-0 text-indigo-500">
            {r.done}/{r.total}
          </span>
        )}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-zinc-500">
      <span className="hidden sm:inline">{scan.lastRunAt ? `Scanned ${timeAgo(scan.lastRunAt)}` : "Not scanned yet"}</span>
      {canScan && (
        <Button variant="ghost" size="sm" onClick={onScan} title="Read new messages from your groups">
          <RefreshCw className="size-3.5" /> Scan
        </Button>
      )}
    </div>
  );
}

export function JobsView() {
  const { data, error, refresh, startScan } = useJobsData();
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  const target = data?.settings.targetScore ?? 90;
  const jobs = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const q = query.toLowerCase();
    return (data?.jobs ?? []).filter(
      (j) => f.match(j) && (!q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q)),
    );
  }, [data, filter, query]);
  const selected = data?.jobs.find((j) => j.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const all = data?.jobs ?? [];
    return Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.match).length]));
  }, [data]);

  const setUp = !!data?.settings.sources.length;

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <JobsHeader active="jobs">
        {error && <span className="text-xs text-rose-600">{error}</span>}
        {data && <ScanStatus scan={data.scan} canScan={setUp} onScan={() => startScan()} />}
        <Button onClick={() => setPasting(true)}>
          <ClipboardPaste className="size-3.5" /> Paste a job
        </Button>
        <Link
          href="/jobs/settings"
          title="Telegram, daily scan and matching settings"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-800 shadow-xs hover:bg-zinc-50"
        >
          <Settings className="size-3.5" /> Settings
        </Link>
      </JobsHeader>

      {!data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading jobs…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className="flex w-[440px] shrink-0 flex-col border-r border-zinc-200">
            <div className="space-y-2 border-b border-zinc-200 bg-white p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-zinc-400" />
                <input
                  className={cx(inputClass, "pl-8")}
                  placeholder="Search jobs…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cx(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      filter === f.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                    )}
                  >
                    {f.label} <span className="opacity-60">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {jobs.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs leading-relaxed text-zinc-500">
                  {data.jobs.length > 0 ? (
                    "Nothing in this filter."
                  ) : !setUp ? (
                    <>
                      Connect Telegram and choose your job groups to start.
                      <div className="mt-3">
                        <Link
                          href="/jobs/settings"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500"
                        >
                          <Settings className="size-3.5" /> Open settings
                        </Link>
                      </div>
                    </>
                  ) : data.scan.running ? (
                    "Scanning your groups. Jobs in your field appear here as they're found."
                  ) : (
                    <>
                      No jobs yet. Scan your groups, or{" "}
                      <button className="font-medium text-indigo-600" onClick={() => setPasting(true)}>
                        paste a job
                      </button>{" "}
                      from anywhere.
                    </>
                  )}
                </div>
              )}
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} target={target} active={j.id === selectedId} onClick={() => setSelectedId(j.id)} />
              ))}
            </div>
          </section>

          <main className="min-w-0 flex-1 bg-white">
            {selected ? (
              <JobDetail
                summary={selected}
                target={target}
                onChanged={refresh}
                onDeleted={() => {
                  setSelectedId(null);
                  refresh();
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Briefcase className="size-6" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-zinc-900">Your tailored applications</h2>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
                  Every day the scan reads your Telegram job groups, keeps the jobs in your field, extracts each job&apos;s ATS
                  keywords, and tailors a copy of your base CV to it — aiming for a {target}%+ keyword match without inventing
                  experience.
                </p>
              </div>
            )}
          </main>
        </div>
      )}

      {pasting && (
        <PasteDialog
          title="Paste a job description"
          hint="From LinkedIn, JobStreet, an email… It's tailored right away."
          submitLabel="Add & tailor"
          busyLabel="Reading job…"
          onClose={() => setPasting(false)}
          onSubmit={async (text) => {
            const { id } = await postJson("/api/jobs", { text });
            setPasting(false);
            setFilter("all");
            setSelectedId(id);
            refresh();
          }}
        />
      )}
    </div>
  );
}
