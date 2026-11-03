import { stripRich } from "./richtext";
import type { Block, Resume } from "./types";

/**
 * JSON Pointer (RFC 6901) helpers with immutable updates.
 * Paths look like "/sections/2/entries/0/blocks/1/items/3".
 */

type Json = unknown;
type Container = Record<string, Json> | Json[];

export function parsePointer(pointer: string): string[] {
  if (!pointer) return [];
  if (!pointer.startsWith("/")) throw new Error(`Invalid path "${pointer}"`);
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function toPointer(segs: (string | number)[]): string {
  return segs
    .map((s) => "/" + String(s).replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("");
}

export function parentPointer(pointer: string): string {
  const segs = parsePointer(pointer);
  return toPointer(segs.slice(0, -1));
}

export function lastSegment(pointer: string): string {
  const segs = parsePointer(pointer);
  return segs[segs.length - 1] ?? "";
}

function isContainer(v: Json): v is Container {
  return typeof v === "object" && v !== null;
}

function child(v: Json, key: string): Json {
  if (Array.isArray(v)) return v[Number(key)];
  if (isContainer(v)) return (v as Record<string, Json>)[key];
  return undefined;
}

export function getAt<T = Json>(root: Json, pointer: string): T | undefined {
  let cur: Json = root;
  for (const seg of parsePointer(pointer)) {
    if (!isContainer(cur)) return undefined;
    cur = child(cur, seg);
  }
  return cur as T | undefined;
}

export function hasPath(root: Json, pointer: string): boolean {
  return getAt(root, pointer) !== undefined;
}

/** Clone containers along `segs` and apply `fn` to the final parent container (mutating the clone). */
function updateIn<T>(
  root: T,
  segs: string[],
  fn: (parent: Container, key: string) => void,
): T {
  if (segs.length === 0) throw new Error("Cannot modify the document root");
  const rootClone = cloneShallow(root as Json);
  let cur = rootClone;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = child(cur, segs[i]);
    if (!isContainer(next)) {
      throw new Error(`Path not found: ${toPointer(segs.slice(0, i + 1))}`);
    }
    const nextClone = cloneShallow(next);
    setChild(cur, segs[i], nextClone);
    cur = nextClone;
  }
  fn(cur, segs[segs.length - 1]);
  return rootClone as T;
}

function cloneShallow(v: Json): Container {
  if (Array.isArray(v)) return [...v];
  if (isContainer(v)) return { ...(v as Record<string, Json>) };
  throw new Error("Not a container");
}

function setChild(parent: Container, key: string, value: Json) {
  if (Array.isArray(parent)) parent[Number(key)] = value;
  else parent[key] = value;
}

function arrayIndex(arr: Json[], key: string, allowEnd: boolean): number {
  if (key === "-" && allowEnd) return arr.length;
  if (!/^\d+$/.test(key)) throw new Error(`Invalid array index "${key}"`);
  const idx = Number(key);
  const max = allowEnd ? arr.length : arr.length - 1;
  if (idx > max) throw new Error(`Array index ${idx} out of range`);
  return idx;
}

export function setAt<T>(root: T, pointer: string, value: Json): T {
  return updateIn(root, parsePointer(pointer), (parent, key) => {
    if (Array.isArray(parent)) parent[arrayIndex(parent, key, false)] = value;
    else parent[key] = value;
  });
}

/** JSON-Patch "add": inserts into arrays (index or "-"), sets object keys. */
export function addAt<T>(root: T, pointer: string, value: Json): T {
  return updateIn(root, parsePointer(pointer), (parent, key) => {
    if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, true), 0, value);
    else parent[key] = value;
  });
}

export function removeAt<T>(root: T, pointer: string): T {
  return updateIn(root, parsePointer(pointer), (parent, key) => {
    if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, false), 1);
    else {
      if (!(key in parent)) throw new Error(`Path not found: ${pointer}`);
      delete parent[key];
    }
  });
}

export interface ArrayItemInfo {
  arrayPath: string;
  index: number;
  length: number;
}

/** If `pointer` addresses an array element, describe its position. */
export function arrayItemInfo(root: Json, pointer: string): ArrayItemInfo | null {
  const segs = parsePointer(pointer);
  if (!segs.length) return null;
  const key = segs[segs.length - 1];
  if (!/^\d+$/.test(key)) return null;
  const arrayPath = toPointer(segs.slice(0, -1));
  const arr = getAt(root, arrayPath);
  if (!Array.isArray(arr)) return null;
  return { arrayPath, index: Number(key), length: arr.length };
}

export function moveItem<T>(root: T, pointer: string, delta: number): { doc: T; path: string } {
  const info = arrayItemInfo(root, pointer);
  if (!info) return { doc: root, path: pointer };
  const to = Math.max(0, Math.min(info.length - 1, info.index + delta));
  if (to === info.index) return { doc: root, path: pointer };
  const doc = updateIn(root, parsePointer(info.arrayPath), (parent, key) => {
    const arr = [...(child(parent, key) as Json[])];
    const [item] = arr.splice(info.index, 1);
    arr.splice(to, 0, item);
    setChild(parent, key, arr);
  });
  return { doc, path: `${info.arrayPath}/${to}` };
}

// ---------------------------------------------------------------------------
// Human readable labels for paths (used by the inspector and the AI context)
// ---------------------------------------------------------------------------

export interface Crumb {
  path: string;
  label: string;
}

const BLOCK_LABEL: Record<Block["type"], string> = {
  title: "Title",
  text: "Text",
  bullets: "Bullet list",
  links: "Links",
};

function truncate(s: string, n = 34) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export function entryLabel(resume: Resume, si: number, ei: number): string {
  const entry = resume.sections[si]?.entries[ei];
  const title = entry?.blocks.find((b) => b.type === "title") as
    | { text: string }
    | undefined;
  return title ? truncate(stripRich(title.text)) : `Entry ${ei + 1}`;
}

export function describePath(resume: Resume, pointer: string): Crumb[] {
  const segs = parsePointer(pointer);
  const crumbs: Crumb[] = [];
  if (segs[0] === "header") {
    crumbs.push({ path: "/header", label: "Header" });
    if (segs[1] === "name") crumbs.push({ path: "/header/name", label: "Name" });
    if (segs[1] === "contacts" && segs[2] !== undefined) {
      crumbs.push({
        path: toPointer(segs.slice(0, 3)),
        label: `Contact ${Number(segs[2]) + 1}`,
      });
    }
    return crumbs;
  }
  if (segs[0] !== "sections" || segs[1] === undefined) return crumbs;
  const si = Number(segs[1]);
  const section = resume.sections[si];
  if (!section) return crumbs;
  crumbs.push({ path: toPointer(segs.slice(0, 2)), label: titleCase(section.title) || `Section ${si + 1}` });
  if (segs[2] !== "entries" || segs[3] === undefined) return crumbs;
  const ei = Number(segs[3]);
  crumbs.push({ path: toPointer(segs.slice(0, 4)), label: entryLabel(resume, si, ei) });
  if (segs[4] !== "blocks" || segs[5] === undefined) return crumbs;
  const bi = Number(segs[5]);
  const block = section.entries[ei]?.blocks[bi];
  if (!block) return crumbs;
  crumbs.push({ path: toPointer(segs.slice(0, 6)), label: BLOCK_LABEL[block.type] });
  if (segs[6] === "items" && segs[7] !== undefined) {
    const n = Number(segs[7]) + 1;
    crumbs.push({
      path: toPointer(segs.slice(0, 8)),
      label: block.type === "links" ? `Link ${n}` : `Bullet ${n}`,
    });
  }
  return crumbs;
}

export function pathLabel(resume: Resume, pointer: string): string {
  return describePath(resume, pointer)
    .map((c) => c.label)
    .join(" › ");
}

/**
 * For an inspected element, returns the pointer of the rich-text string that
 * can be quick-edited (or null if the element is a container).
 */
export function editableTextPath(resume: Resume, pointer: string): string | null {
  const segs = parsePointer(pointer);
  if (pointer === "/header/name") return pointer;
  if (segs[0] === "header" && segs[1] === "contacts" && segs.length === 3) {
    return `${pointer}/label`;
  }
  if (segs[0] === "sections" && segs.length === 2) return `${pointer}/title`;
  if (segs[4] === "blocks" && segs.length === 6) {
    const block = getAt<Block>(resume, pointer);
    if (block && (block.type === "title" || block.type === "text")) return `${pointer}/text`;
    return null;
  }
  if (segs[6] === "items" && segs.length === 8) {
    const block = getAt<Block>(resume, toPointer(segs.slice(0, 6)));
    if (block?.type === "links") return `${pointer}/label`;
    if (block?.type === "bullets") return pointer;
  }
  return null;
}
