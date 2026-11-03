import type { ChatMessage } from "@/store/editor-store";
import type { Resume } from "./resume/types";

const DRAFT_KEY = "cv-maker:draft:v1";
const CHAT_KEY = "cv-maker:chat:v1";
const PRINT_KEY = "cv-maker:print:v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the server copy (Save) is the durable one.
  }
}

export const loadDraft = () => read<Resume>(DRAFT_KEY);
export const saveDraft = (resume: Resume) => write(DRAFT_KEY, resume);
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

/** Chat history without the per-message resume snapshots (too large to keep). */
export const loadChat = (scope = "") => read<ChatMessage[]>(CHAT_KEY + scope) ?? [];
export const saveChat = (chat: ChatMessage[], scope = "") =>
  write(
    CHAT_KEY + scope,
    chat.slice(-60).map(({ before, after, ...rest }) => {
      void before;
      void after;
      return rest;
    }),
  );

/** Hand-off for the browser print fallback (the print tab reads it once). */
export const setPrintPayload = (resume: Resume) => write(PRINT_KEY, resume);
export const takePrintPayload = () => {
  const r = read<Resume>(PRINT_KEY);
  try {
    localStorage.removeItem(PRINT_KEY);
  } catch {}
  return r;
};
