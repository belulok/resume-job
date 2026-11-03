"use client";

import { create } from "zustand";
import { defaultResume } from "@/lib/resume/default-resume";
import { withFreshIds } from "@/lib/resume/normalize";
import { addAt, arrayItemInfo, getAt, moveItem, removeAt, setAt } from "@/lib/resume/paths";
import type { PatchOp } from "@/lib/resume/patch";
import type { Resume } from "@/lib/resume/types";
import type { PageLayout } from "@/lib/resume/units";
import type { JobKeyword } from "@/lib/jobs/types";

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1200;

export type LeftTab = "edit" | "chat";

/** Which document the editor is working on: the base resume or a job's tailored copy. */
export type EditorDoc =
  | { kind: "base" }
  | {
      kind: "job";
      jobId: string;
      title: string;
      company: string;
      description: string;
      keywords: JobKeyword[];
      targetScore: number;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Selection the user attached to the request. */
  contextLabel?: string;
  ops?: PatchOp[];
  opErrors?: string[];
  /** Snapshot before the AI change, to allow reverting it. */
  before?: Resume;
  after?: Resume;
  error?: boolean;
  provider?: string;
}

interface EditorState {
  resume: Resume;
  past: Resume[];
  future: Resume[];
  lastCommit: { key?: string; at: number };

  hydrated: boolean;
  doc: EditorDoc;
  savedJson: string;
  savedAt: number | null;
  saving: boolean;

  selectedPath: string | null;
  hoveredPath: string | null;
  /** Bumped when the form editor should reveal a path. */
  revealRequest: { path: string; nonce: number; focus: boolean } | null;
  quickEditPath: string | null;
  flash: { paths: string[]; nonce: number } | null;

  tab: LeftTab;
  inspect: boolean;
  zoom: number | "fit";
  layout: PageLayout[];

  chat: ChatMessage[];
  chatPending: boolean;
  chatDraft: string;
  /** When set, the next chat request is scoped to this element. */
  chatContextPath: string | null;

  hydrate: (
    resume: Resume,
    savedJson: string,
    savedAt: number | null,
    chat?: ChatMessage[],
    doc?: EditorDoc,
  ) => void;
  commit: (next: Resume, opts?: { coalesceKey?: string }) => void;
  updateAt: (path: string, value: unknown, coalesceKey?: string) => void;
  removeAt: (path: string) => void;
  insertAt: (path: string, value: unknown) => void;
  moveAt: (path: string, delta: number) => void;
  duplicateAt: (path: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (json: string) => void;
  setSaving: (saving: boolean) => void;

  select: (path: string | null, opts?: { reveal?: boolean; focus?: boolean }) => void;
  hover: (path: string | null) => void;
  setQuickEdit: (path: string | null) => void;
  flashPaths: (paths: string[]) => void;

  setTab: (tab: LeftTab) => void;
  setInspect: (on: boolean) => void;
  setZoom: (zoom: number | "fit") => void;
  setLayout: (layout: PageLayout[]) => void;

  pushChat: (msg: ChatMessage) => void;
  updateChat: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  setChatPending: (pending: boolean) => void;
  setChatDraft: (draft: string) => void;
  setChatContext: (path: string | null) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  resume: defaultResume,
  past: [],
  future: [],
  lastCommit: { at: 0 },

  hydrated: false,
  doc: { kind: "base" },
  savedJson: JSON.stringify(defaultResume),
  savedAt: null,
  saving: false,

  selectedPath: null,
  hoveredPath: null,
  revealRequest: null,
  quickEditPath: null,
  flash: null,

  tab: "edit",
  inspect: true,
  zoom: "fit",
  layout: [],

  chat: [],
  chatPending: false,
  chatDraft: "",
  chatContextPath: null,

  hydrate: (resume, savedJson, savedAt, chat, doc) =>
    set({
      resume,
      savedJson,
      savedAt,
      hydrated: true,
      chat: chat ?? [],
      past: [],
      future: [],
      doc: doc ?? { kind: "base" },
    }),

  commit: (next, opts) => {
    const { resume, past, lastCommit } = get();
    if (next === resume) return;
    const now = Date.now();
    const coalesce =
      opts?.coalesceKey !== undefined &&
      opts.coalesceKey === lastCommit.key &&
      now - lastCommit.at < COALESCE_MS &&
      past.length > 0;
    set({
      resume: next,
      past: coalesce ? past : [...past, resume].slice(-HISTORY_LIMIT),
      future: [],
      lastCommit: { key: opts?.coalesceKey, at: now },
    });
  },

  updateAt: (path, value, coalesceKey) => {
    const { resume, commit } = get();
    if (getAt(resume, path) === value) return;
    commit(setAt(resume, path, value), { coalesceKey: coalesceKey ?? path });
  },

  removeAt: (path) => {
    const { resume, commit, selectedPath } = get();
    commit(removeAt(resume, path));
    if (selectedPath && (selectedPath === path || selectedPath.startsWith(path + "/"))) {
      set({ selectedPath: null, quickEditPath: null });
    }
  },

  insertAt: (path, value) => {
    const { resume, commit } = get();
    commit(addAt(resume, path, value));
  },

  moveAt: (path, delta) => {
    const { resume, commit, selectedPath } = get();
    const { doc, path: newPath } = moveItem(resume, path, delta);
    if (doc === resume) return;
    commit(doc);
    if (selectedPath === path) set({ selectedPath: newPath });
  },

  duplicateAt: (path) => {
    const { resume, commit } = get();
    const info = arrayItemInfo(resume, path);
    if (!info) return;
    const copy = withFreshIds(structuredClone(getAt(resume, path)));
    const newPath = `${info.arrayPath}/${info.index + 1}`;
    commit(addAt(resume, newPath, copy));
    set({ selectedPath: newPath });
  },

  undo: () => {
    const { past, future, resume } = get();
    if (!past.length) return;
    set({
      resume: past[past.length - 1],
      past: past.slice(0, -1),
      future: [resume, ...future],
      lastCommit: { at: 0 },
      quickEditPath: null,
    });
  },

  redo: () => {
    const { past, future, resume } = get();
    if (!future.length) return;
    set({
      resume: future[0],
      past: [...past, resume],
      future: future.slice(1),
      lastCommit: { at: 0 },
      quickEditPath: null,
    });
  },

  markSaved: (json) => set({ savedJson: json, savedAt: Date.now(), saving: false }),
  setSaving: (saving) => set({ saving }),

  select: (path, opts) =>
    set((s) => ({
      selectedPath: path,
      quickEditPath: path === s.quickEditPath ? s.quickEditPath : null,
      revealRequest:
        path && opts?.reveal ? { path, nonce: Date.now(), focus: !!opts.focus } : s.revealRequest,
    })),
  hover: (path) => {
    if (get().hoveredPath !== path) set({ hoveredPath: path });
  },
  setQuickEdit: (path) => set({ quickEditPath: path }),
  flashPaths: (paths) => set({ flash: { paths, nonce: Date.now() } }),

  setTab: (tab) => set({ tab }),
  setInspect: (inspect) => set({ inspect, hoveredPath: null }),
  setZoom: (zoom) => set({ zoom }),
  setLayout: (layout) => set({ layout }),

  pushChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
  updateChat: (id, patch) =>
    set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  clearChat: () => set({ chat: [] }),
  setChatPending: (chatPending) => set({ chatPending }),
  setChatDraft: (chatDraft) => set({ chatDraft }),
  setChatContext: (chatContextPath) => set({ chatContextPath }),
}));
