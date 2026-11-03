import type { Block, BulletMarker, Entry, Resume, Section } from "./types";

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const BLOCK_TYPES = new Set(["title", "text", "bullets", "links"]);
const MARKERS = new Set<BulletMarker>(["disc", "dot", "inline"]);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function normalizeBlock(raw: unknown): Block | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const type = BLOCK_TYPES.has(str(b.type)) ? (b.type as Block["type"]) : "text";
  const base = { id: str(b.id) || uid("b"), gap: num(b.gap) };
  const align = b.align === "justify" ? ("justify" as const) : b.align === "left" ? ("left" as const) : undefined;
  switch (type) {
    case "title":
      return { ...base, type, text: str(b.text), align };
    case "text":
      return {
        ...base,
        type,
        text: str(b.text),
        align,
        size: b.size === "xs" ? "xs" : undefined,
        indent: num(b.indent),
      };
    case "bullets":
      return {
        ...base,
        type,
        items: Array.isArray(b.items) ? b.items.map((i) => str(i)) : [],
        marker: MARKERS.has(b.marker as BulletMarker) ? (b.marker as BulletMarker) : undefined,
        align,
        spacing: num(b.spacing),
      };
    case "links":
      return {
        ...base,
        type,
        items: Array.isArray(b.items)
          ? b.items.map((i) => {
              const it = (typeof i === "object" && i ? i : {}) as Record<string, unknown>;
              const url = str(it.url);
              return { label: str(it.label, url), url };
            })
          : [],
      };
  }
}

function normalizeEntry(raw: unknown): Entry {
  const e = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  const blocks = Array.isArray(e.blocks)
    ? e.blocks.map(normalizeBlock).filter((b): b is Block => !!b)
    : [];
  return { id: str(e.id) || uid("e"), gap: num(e.gap), blocks };
}

function normalizeSection(raw: unknown): Section {
  const s = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  return {
    id: str(s.id) || uid("s"),
    title: str(s.title),
    column: s.column === "right" ? "right" : "left",
    hidden: s.hidden === true ? true : undefined,
    gap: num(s.gap),
    headingGap: num(s.headingGap),
    entryGap: num(s.entryGap),
    entries: Array.isArray(s.entries) ? s.entries.map(normalizeEntry) : [],
  };
}

/** Coerce arbitrary (possibly AI- or user-edited) JSON into a valid Resume, filling ids. */
export function normalizeResume(raw: unknown): Resume {
  const r = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  const h = (typeof r.header === "object" && r.header ? r.header : {}) as Record<string, unknown>;
  const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return stripUndefined({
    version: 1,
    template: "classic",
    title: str(r.title, "My Resume"),
    header: {
      name: str(h.name),
      contacts: Array.isArray(h.contacts)
        ? h.contacts.map((c) => {
            const o = (typeof c === "object" && c ? c : { label: c }) as Record<string, unknown>;
            return { id: str(o.id) || uid("c"), label: str(o.label), url: o.url ? str(o.url) : undefined };
          })
        : [],
    },
    sections: Array.isArray(r.sections) ? r.sections.map(normalizeSection) : [],
  });
}

/** Deep-copy a value giving every section / entry / block / contact a fresh id. */
export function withFreshIds<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object" && v !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      if (typeof out.id === "string") out.id = uid(out.id.charAt(0));
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
