"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Crosshair, Eraser, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import { scoreResume } from "@/lib/jobs/score";
import { applyOps, type PatchOp } from "@/lib/resume/patch";
import { getAt, pathLabel } from "@/lib/resume/paths";
import type { Resume } from "@/lib/resume/types";
import { useEditor, type ChatMessage } from "@/store/editor-store";
import { IconButton, cx } from "../../ui";

const GENERAL_SUGGESTIONS = [
  "Fix typos and grammar across the whole resume",
  "Tailor my resume for a Senior AI Engineer role",
  "Make the Experience bullets more concise and results-focused",
  "Add a new skill: Kubernetes, under Familiar with",
];

const JOB_SUGGESTIONS = [
  "Raise my match score — cover missing keywords my experience supports",
  "Reorder my bullets so the most relevant to this job come first",
  "Fix typos and grammar across the whole resume",
];

const SELECTION_SUGGESTIONS = [
  "Rewrite this to sound more impactful",
  "Make this more concise",
  "Bold the key results",
  "Fix grammar",
];

const OP_VERB: Record<PatchOp["op"], string> = {
  replace: "Edited",
  add: "Added",
  remove: "Removed",
  move: "Moved",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function useProvider() {
  const [provider, setProvider] = useState<{ kind: string; label: string } | null>(null);
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => setProvider({ kind: "none", label: "Unavailable" }));
  }, []);
  return provider;
}

function safeLabel(resume: Resume | undefined, path: string) {
  try {
    return resume ? pathLabel(resume, path) || path : path;
  } catch {
    return path;
  }
}

function ChangeList({ msg }: { msg: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const current = useEditor((s) => s.resume);
  const { commit, select, flashPaths } = useEditor.getState();
  const ops = msg.ops ?? [];
  if (!ops.length && !msg.opErrors?.length) return null;
  const isLatest = msg.after && current === msg.after;

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-white text-xs">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {ops.length > 0 ? (
          <span className="flex items-center gap-1 font-medium text-emerald-700">
            <Check className="size-3.5" /> {ops.length} change{ops.length === 1 ? "" : "s"} applied
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-amber-700">
            <TriangleAlert className="size-3.5" /> No changes could be applied
          </span>
        )}
        <button className="ml-auto flex items-center gap-0.5 text-zinc-500 hover:text-zinc-800" onClick={() => setOpen((o) => !o)}>
          Details <ChevronDown className={cx("size-3 transition-transform", open && "rotate-180")} />
        </button>
        {msg.before && ops.length > 0 && (
          <button
            className="flex items-center gap-1 rounded-md border border-zinc-200 px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-50"
            title={isLatest ? "Undo these changes" : "Restore the resume to how it was before this change"}
            onClick={() => {
              if (isLatest) useEditor.getState().undo();
              else if (confirm("Restore the version from before this AI change? Later edits will be replaced (you can undo).")) {
                commit(msg.before!);
              }
            }}
          >
            <RotateCcw className="size-3" /> {isLatest ? "Undo" : "Restore"}
          </button>
        )}
      </div>
      {open && (
        <ul className="space-y-0.5 border-t border-zinc-100 px-2.5 py-1.5">
          {ops.map((op, i) => (
            <li key={i}>
              <button
                className="flex w-full items-center gap-1 truncate text-left text-zinc-600 hover:text-indigo-700"
                onClick={() => {
                  if (op.op === "remove") return;
                  select(op.path);
                  flashPaths([op.path]);
                }}
              >
                <Crosshair className="size-3 shrink-0 text-zinc-400" />
                <span className="font-medium">{OP_VERB[op.op]}</span>
                <span className="truncate">{safeLabel(op.op === "remove" ? msg.before : msg.after, op.path)}</span>
              </button>
            </li>
          ))}
          {msg.opErrors?.map((err, i) => (
            <li key={`e${i}`} className="text-amber-700">
              Skipped: {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Message({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end">
        {msg.contextLabel && (
          <span className="mb-1 flex max-w-[85%] items-center gap-1 truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
            <Crosshair className="size-3 shrink-0" /> {msg.contextLabel}
          </span>
        )}
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-[13px] leading-relaxed text-white">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div
        className={cx(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          msg.error ? "bg-red-100 text-red-600" : "bg-gradient-to-br from-indigo-500 to-violet-500 text-white",
        )}
      >
        {msg.error ? <TriangleAlert className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "whitespace-pre-wrap text-[13px] leading-relaxed",
            msg.error ? "rounded-lg bg-red-50 px-2.5 py-2 text-red-700" : "text-zinc-800",
          )}
        >
          {msg.content}
        </div>
        <ChangeList msg={msg} />
      </div>
    </div>
  );
}

export function ChatPanel() {
  const chat = useEditor((s) => s.chat);
  const pending = useEditor((s) => s.chatPending);
  const draft = useEditor((s) => s.chatDraft);
  const selectedPath = useEditor((s) => s.selectedPath);
  const resume = useEditor((s) => s.resume);
  const provider = useProvider();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectionLabel = selectedPath ? safeLabel(resume, selectedPath) : null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, pending]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const send = async (text: string) => {
    const message = text.trim();
    const s = useEditor.getState();
    if (!message || s.chatPending) return;

    const snapshot = s.resume;
    const job =
      s.doc.kind === "job"
        ? {
            title: s.doc.title,
            company: s.doc.company,
            description: s.doc.description.slice(0, 12000),
            missingKeywords: scoreResume(snapshot, s.doc.keywords).missing,
          }
        : null;
    const selection = s.selectedPath
      ? { path: s.selectedPath, label: safeLabel(snapshot, s.selectedPath), value: getAt(snapshot, s.selectedPath) }
      : null;
    const history = s.chat
      .filter((m) => !m.error)
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content:
          m.role === "assistant" && m.ops?.length ? `${m.content}\n[Applied ${m.ops.length} edit operation(s).]` : m.content,
      }));

    s.pushChat({ id: uid(), role: "user", content: message, contextLabel: selection?.label });
    s.setChatDraft("");
    s.setChatPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: snapshot, message, history, selection, job }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      const ops: PatchOp[] = (data.operations ?? []).map((o: PatchOp) => ({
        op: o.op,
        path: o.path,
        from: o.from || undefined,
        value: o.value || undefined,
      }));
      // Apply to the latest resume (the user may have kept editing while waiting).
      const before = useEditor.getState().resume;
      const result = applyOps(before, ops);
      if (result.applied.length) {
        useEditor.getState().commit(result.resume);
        useEditor.getState().flashPaths(result.touched);
      }
      useEditor.getState().pushChat({
        id: uid(),
        role: "assistant",
        content: data.reply || (result.applied.length ? "Done." : "No changes needed."),
        ops: result.applied,
        opErrors: result.errors,
        before,
        after: result.applied.length ? result.resume : undefined,
        provider: data.provider,
      });
    } catch (e) {
      useEditor.getState().pushChat({ id: uid(), role: "assistant", content: (e as Error).message, error: true });
    } finally {
      useEditor.getState().setChatPending(false);
    }
  };

  const docKind = useEditor((s) => s.doc.kind);
  const suggestions = selectedPath ? SELECTION_SUGGESTIONS : docKind === "job" ? JOB_SUGGESTIONS : GENERAL_SUGGESTIONS;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
        <span
          className={cx(
            "size-2 rounded-full",
            provider === null ? "bg-zinc-300" : provider.kind === "none" ? "bg-red-500" : "bg-emerald-500",
          )}
        />
        <span className="truncate text-xs text-zinc-600">{provider?.label ?? "Checking AI provider…"}</span>
        {chat.length > 0 && (
          <IconButton
            size="sm"
            label="Clear conversation"
            className="ml-auto"
            onClick={() => confirm("Clear the conversation? (Resume changes are kept.)") && useEditor.getState().clearChat()}
          >
            <Eraser className="size-3.5" />
          </IconButton>
        )}
      </div>

      <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {chat.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <Sparkles className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Edit your resume by chatting</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Ask for rewrites, new sections or tailoring to a job description. Changes are applied straight to the
              preview — every AI change can be undone. Select an element in the preview first to scope the request to
              it.
            </p>
          </div>
        )}
        {chat.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <Sparkles className="size-3.5" />
            </div>
            <span className="flex gap-0.5">
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400" />
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:150ms]" />
              <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:300ms]" />
            </span>
            Editing your resume…
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-white p-2.5">
        {!pending && (
          <div className="mb-2 flex flex-wrap gap-1">
            {suggestions.map((sug) => (
              <button
                key={sug}
                onClick={() => send(sug)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15">
          {selectionLabel && (
            <div className="flex items-center gap-1 px-2 pt-2">
              <span className="flex min-w-0 items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2 pr-1 text-[11px] text-indigo-700">
                <Crosshair className="size-3 shrink-0" />
                <span className="truncate">{selectionLabel}</span>
                <button
                  className="rounded-full p-0.5 hover:bg-indigo-100"
                  title="Clear selection (apply to whole resume)"
                  onClick={() => useEditor.getState().select(null)}
                >
                  <X className="size-3" />
                </button>
              </span>
            </div>
          )}
          <div className="flex items-end gap-1 p-1.5">
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => useEditor.getState().setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={
                selectionLabel ? "What should change in the selected element?" : "Describe a change… (paste a job description to tailor)"
              }
              className="max-h-44 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={() => send(draft)}
              disabled={!draft.trim() || pending}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-zinc-400">Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
