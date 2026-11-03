"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Briefcase, FileText, PenLine } from "lucide-react";
import type { JobSettings, JobSummary, ScanProgress, ScanResult } from "@/lib/jobs/types";
import { cx } from "../ui";

export interface JobsResponse {
  jobs: JobSummary[];
  settings: JobSettings;
  scan: {
    running: ScanProgress | null;
    lastRunAt: string | null;
    lastResult: ScanResult | null;
    nextRunAt: string | null;
    log: string[];
  };
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return d.getTime() - Date.now() < 60_000 ? "due now" : `today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  return d.toLocaleString();
}

/** Jobs, settings and scan state, polled faster while a scan or tailoring is running. */
export function useJobsData() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      setData(await res.json());
      setError(null);
    } catch {
      setError("Can't reach the dev server.");
    }
  }, []);

  const busy =
    !!data?.scan.running ||
    !!data?.jobs.some(
      (j) =>
        j.status === "queued" ||
        j.status === "tailoring" ||
        ["running", "waiting", "review"].includes(j.application?.state ?? ""),
    );
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, busy ? 2500 : 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh, busy]);

  /** Apply locally right away, save after a short pause. */
  const updateSettings = (patch: Partial<JobSettings>) => {
    if (!data) return;
    const settings = { ...data.settings, ...patch };
    setData({ ...data, settings });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/jobs/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      refresh();
    }, 500);
  };

  const startScan = async (days?: number) => {
    const res = await fetch("/api/jobs/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(days ? { days } : {}),
    });
    if (!res.ok) alert((await res.json()).reason ?? "Could not start the scan.");
    setTimeout(refresh, 400);
  };

  return { data, error, refresh, updateSettings, startScan };
}

export function JobsHeader({ active, children }: { active: "jobs" | "settings"; children?: React.ReactNode }) {
  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      <div className="flex items-center gap-2 pr-1">
        <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <FileText className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-900">CV Studio</span>
      </div>
      <div className="h-5 w-px bg-zinc-200" />
      <nav className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-zinc-600 hover:bg-zinc-100">
          <PenLine className="size-4" /> Base CV
        </a>
        <Link
          href="/jobs"
          className={cx(
            "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px]",
            active === "jobs" ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <Briefcase className={cx("size-4", active === "jobs" && "text-indigo-600")} /> Jobs
        </Link>
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div>
    </header>
  );
}
