import { stripRich } from "@/lib/resume/richtext";
import type { Resume } from "@/lib/resume/types";
import type { JobKeyword } from "./types";

/**
 * ATS-style similarity: the weighted share of the job's keywords that appear
 * in the resume text (exact term or a known alias, plural-tolerant,
 * punctuation-insensitive). Deterministic, so it can be recomputed live.
 */

export function resumePlainText(resume: Resume): string {
  const parts: string[] = [resume.header.name, ...resume.header.contacts.map((c) => c.label)];
  for (const section of resume.sections) {
    if (section.hidden) continue;
    parts.push(section.title);
    for (const entry of section.entries) {
      for (const block of entry.blocks) {
        if (block.type === "title" || block.type === "text") parts.push(stripRich(block.text));
        else if (block.type === "bullets") parts.push(...block.items.map(stripRich));
        else parts.push(...block.items.map((i) => `${i.label} ${i.url}`));
      }
    }
  }
  return parts.join("\n");
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

const compact = (t: string) => t.replace(/[.\-]/g, "");
const singular = (t: string) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

export interface ResumeIndex {
  phrases: Set<string>;
  compacts: Set<string>;
}

/** All 1–5 word phrases of the resume, in spaced and compact (no separators) form. */
export function indexText(text: string): ResumeIndex {
  const toks = tokens(text).map(singular);
  const phrases = new Set<string>();
  const compacts = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    for (let n = 1; n <= 5 && i + n <= toks.length; n++) {
      const gram = toks.slice(i, i + n);
      phrases.add(gram.join(" "));
      compacts.add(compact(gram.join("")));
    }
  }
  return { phrases, compacts };
}

function phraseMatches(index: ResumeIndex, phrase: string): boolean {
  const toks = tokens(phrase).map(singular);
  if (!toks.length) return false;
  if (index.phrases.has(toks.join(" "))) return true;
  const c = compact(toks.join(""));
  return c.length >= 3 && index.compacts.has(c);
}

export function keywordMatches(index: ResumeIndex, kw: JobKeyword): boolean {
  return [kw.term, ...kw.aliases].some((p) => phraseMatches(index, p));
}

export interface ScoreResult {
  score: number;
  matched: string[];
  missing: string[];
}

export function scoreResume(resume: Resume, keywords: JobKeyword[]): ScoreResult {
  if (!keywords.length) return { score: 0, matched: [], missing: [] };
  const index = indexText(resumePlainText(resume));
  let total = 0;
  let got = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    const w = Math.max(1, Math.min(3, Math.round(kw.weight) || 1));
    total += w;
    if (keywordMatches(index, kw)) {
      got += w;
      matched.push(kw.term);
    } else {
      missing.push(kw.term);
    }
  }
  return { score: Math.round((got / total) * 100), matched, missing };
}
