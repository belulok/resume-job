"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Briefcase,
  Check,
  ChevronDown,
  Download,
  FileText,
  FileType2,
  Loader2,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Upload,
  FileType,
} from "lucide-react";
import { exportDocx, exportJson, exportPdf, exportText, printResume } from "@/lib/export/exporters";
import { defaultResume } from "@/lib/resume/default-resume";
import { normalizeResume } from "@/lib/resume/normalize";
import { CLASSIC } from "@/templates/classic/ClassicTemplate";
import { useEditor } from "@/store/editor-store";
import { Button, IconButton, Kbd, cx } from "../ui";
import { MatchScore } from "./MatchScore";

function timeAgo(ts: number | null) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(ts).toLocaleString();
}

function SaveStatus() {
  const resume = useEditor((s) => s.resume);
  const savedJson = useEditor((s) => s.savedJson);
  const savedAt = useEditor((s) => s.savedAt);
  const saving = useEditor((s) => s.saving);
  const dirty = useMemo(() => JSON.stringify(resume) !== savedJson, [resume, savedJson]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  if (saving)
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (dirty)
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600">
        <span className="size-1.5 rounded-full bg-amber-500" /> Unsaved changes
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-zinc-500">
      <Check className="size-3 text-emerald-600" /> Saved {timeAgo(savedAt)}
    </span>
  );
}

type ExportKind = "pdf" | "docx" | "txt" | "json";

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const run = async (kind: ExportKind) => {
    const { resume, layout } = useEditor.getState();
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPdf(resume);
      if (kind === "docx") await exportDocx(resume, layout);
      if (kind === "txt") exportText(resume);
      if (kind === "json") exportJson(resume);
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      useEditor.getState().commit(normalizeResume(data.resume ?? data));
    } catch {
      alert("That file isn't a valid resume JSON.");
    }
  };

  const items: { kind: ExportKind; label: string; hint: string; icon: React.ReactNode }[] = [
    { kind: "pdf", label: "PDF", hint: ".pdf · print-ready vector", icon: <FileText className="size-4 text-red-500" /> },
    { kind: "docx", label: "Word", hint: ".docx · editable in Word / Google Docs", icon: <FileType2 className="size-4 text-blue-600" /> },
    { kind: "txt", label: "Plain text", hint: ".txt · for ATS forms", icon: <FileType className="size-4 text-zinc-500" /> },
    { kind: "json", label: "JSON", hint: ".json · backup / re-import", icon: <Braces className="size-4 text-amber-600" /> },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        Export
        <ChevronDown className="size-3.5 opacity-70" />
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Download as
          </div>
          {items.map((it) => (
            <button
              key={it.kind}
              onClick={() => run(it.kind)}
              disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50 disabled:opacity-50"
            >
              {busy === it.kind ? <Loader2 className="size-4 animate-spin text-zinc-400" /> : it.icon}
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-zinc-900">{it.label}</span>
                <span className="block text-[11px] text-zinc-500">{it.hint}</span>
              </span>
            </button>
          ))}
          <div className="my-1 h-px bg-zinc-100" />
          <button
            onClick={() => {
              printResume(useEditor.getState().resume);
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 hover:bg-zinc-50"
          >
            <Printer className="size-4 text-zinc-500" /> Print…
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 hover:bg-zinc-50"
          >
            <Upload className="size-4 text-zinc-500" /> Import JSON…
          </button>
          <button
            onClick={() => {
              if (confirm("Replace the current resume with the original template content? (You can undo this.)")) {
                useEditor.getState().commit(structuredClone(defaultResume));
              }
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 hover:bg-zinc-50"
          >
            <RotateCcw className="size-4 text-zinc-500" /> Reset to template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function TopBar({ onSave }: { onSave: () => void }) {
  const title = useEditor((s) => s.resume.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const updateAt = useEditor((s) => s.updateAt);
  const saving = useEditor((s) => s.saving);
  const doc = useEditor((s) => s.doc);

  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      <div className="flex items-center gap-2 pr-1">
        <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <FileText className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-900">CV Studio</span>
      </div>
      <div className="h-5 w-px bg-zinc-200" />
      <input
        value={title}
        onChange={(e) => updateAt("/title", e.target.value)}
        className="h-8 w-64 min-w-0 rounded-md border border-transparent px-2 text-sm font-medium text-zinc-800 outline-none hover:border-zinc-200 focus:border-indigo-400"
        aria-label="Document title"
      />
      {doc.kind === "job" ? (
        <Link
          href="/jobs"
          className="flex min-w-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-1.5 pr-2.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
          title="Back to Jobs"
        >
          <ArrowLeft className="size-3 shrink-0" />
          <span className="truncate">
            Tailored for <b>{doc.title}</b>
            {doc.company ? ` @ ${doc.company}` : ""}
          </span>
        </Link>
      ) : (
        <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500 lg:inline">
          Template: {CLASSIC.name}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {doc.kind === "job" ? (
          <>
            <MatchScore />
            {/* Full page load on purpose: the editor must remount to switch documents. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="ml-1 flex h-8 items-center rounded-lg px-2 text-[13px] text-zinc-600 hover:bg-zinc-100"
              title="Open your base resume"
            >
              Base CV
            </a>
          </>
        ) : (
          <Link
            href="/jobs"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <Briefcase className="size-4 text-indigo-600" /> Jobs
          </Link>
        )}
        <div className="mx-1 h-5 w-px bg-zinc-200" />
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="size-4" />
        </IconButton>
        <div className="mx-2 h-5 w-px bg-zinc-200" />
        <SaveStatus />
        <Button onClick={onSave} disabled={saving} className={cx("ml-2")} title="Save (⌘S)">
          <Save className="size-3.5" /> Save <Kbd>⌘S</Kbd>
        </Button>
        <ExportMenu />
      </div>
    </header>
  );
}
