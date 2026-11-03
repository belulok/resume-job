"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { normalizeResume } from "@/lib/resume/normalize";
import { defaultResume } from "@/lib/resume/default-resume";
import { loadChat, loadDraft, saveChat, saveDraft } from "@/lib/storage";
import type { Job } from "@/lib/jobs/types";
import { useEditor, type EditorDoc } from "@/store/editor-store";
import { LeftPanel } from "./LeftPanel";
import { Preview } from "./preview/Preview";
import { TopBar } from "./TopBar";
import { useSave } from "./useSave";

function isTextInput(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export function Editor() {
  const hydrated = useEditor((s) => s.hydrated);
  const save = useSave();
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Load. Base resume: local draft (latest edits) > server save (./data/resume.json) > template.
  // Tailored resume (?job=<id>): the job's copy in ./data/jobs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const server = await fetch("/api/resume")
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      const saved = server?.resume ? normalizeResume(server.resume) : null;
      const draft = loadDraft();
      const base = draft ? normalizeResume(draft) : (saved ?? defaultResume);

      const jobId = new URLSearchParams(window.location.search).get("job");
      if (jobId) {
        const job: Job | null = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const settings = await fetch("/api/jobs/settings")
          .then((r) => r.json())
          .catch(() => ({ targetScore: 90 }));
        if (cancelled) return;
        if (job) {
          const doc: EditorDoc = {
            kind: "job",
            jobId: job.id,
            title: job.title,
            company: job.company,
            description: job.description,
            keywords: job.keywords,
            targetScore: settings.targetScore ?? 90,
          };
          const resume = job.resume ? normalizeResume(job.resume) : base;
          const savedJson = job.resume ? JSON.stringify(resume) : "null";
          useEditor
            .getState()
            .hydrate(resume, savedJson, Date.parse(job.updatedAt), loadChat(`:job:${job.id}`), doc);
          document.title = `${job.title} · CV Studio`;
          return;
        }
      }
      const savedJson = JSON.stringify(saved ?? (draft ? null : defaultResume));
      useEditor.getState().hydrate(base, savedJson, server?.savedAt ?? null, loadChat());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Autosave: base resume → localStorage draft; tailored resume → its job file.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useEditor.subscribe((state, prev) => {
      if (!state.hydrated) return;
      const scope = state.doc.kind === "job" ? `:job:${state.doc.jobId}` : "";
      if (state.resume !== prev.resume && prev.hydrated) {
        clearTimeout(timer);
        if (state.doc.kind === "job") timer = setTimeout(() => saveRef.current(), 900);
        else timer = setTimeout(() => saveDraft(useEditor.getState().resume), 300);
      }
      if (state.chat !== prev.chat) saveChat(state.chat, scope);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useEditor.getState();
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
        return;
      }
      if (isTextInput(document.activeElement)) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if (e.key === "Escape") {
        if (s.quickEditPath) s.setQuickEdit(null);
        else s.select(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.selectedPath) {
        if (/\/\d+$/.test(s.selectedPath)) {
          e.preventDefault();
          s.removeAt(s.selectedPath);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading your resume…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <TopBar onSave={save} />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <Preview />
      </div>
    </div>
  );
}
