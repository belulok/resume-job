"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Target } from "lucide-react";
import { scoreResume } from "@/lib/jobs/score";
import { useEditor } from "@/store/editor-store";
import { cx } from "../ui";

export function scoreTone(score: number, target = 90) {
  if (score >= target) return "emerald";
  if (score >= target - 15) return "amber";
  return "rose";
}

const TONE: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

/** Live ATS match score of the tailored resume against its job (recomputed on every edit). */
export function MatchScore() {
  const doc = useEditor((s) => s.doc);
  const resume = useEditor((s) => s.resume);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => (doc.kind === "job" ? scoreResume(resume, doc.keywords) : null),
    [doc, resume],
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (doc.kind !== "job" || !result) return null;
  const tone = scoreTone(result.score, doc.targetScore);
  const weights = new Map(doc.keywords.map((k) => [k.term, k.weight]));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold", TONE[tone])}
        title="ATS keyword match for this job"
      >
        <Target className="size-3.5" />
        {result.score}% match
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-900/10">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-zinc-900">ATS keyword match</h4>
            <span className="text-xs text-zinc-500">target {doc.targetScore}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cx(
                "h-full rounded-full transition-all",
                tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500",
              )}
              style={{ width: `${result.score}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Weighted share of the job&apos;s keywords found in this CV. Required keywords count 3×, important 2×.
            Updates live as you edit.
          </p>
          {result.missing.length > 0 && (
            <>
              <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Missing ({result.missing.length})
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.missing.map((k) => (
                  <span key={k} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                    {k}
                    {weights.get(k) === 3 && <span className="ml-1 font-semibold">required</span>}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Matched ({result.matched.length})
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {result.matched.map((k) => (
              <span key={k} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                {k}
              </span>
            ))}
          </div>
          {result.missing.length > 0 && (
            <button
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              onClick={() => {
                const s = useEditor.getState();
                s.select(null);
                s.setTab("chat");
                s.setChatDraft(
                  `Raise my match for this job. Missing keywords: ${result.missing.join(", ")}. Only use ones my experience supports.`,
                );
                setOpen(false);
                requestAnimationFrame(() => document.getElementById("chat-input")?.focus());
              }}
            >
              <Sparkles className="size-3.5" /> Ask AI to cover missing keywords
            </button>
          )}
        </div>
      )}
    </div>
  );
}
