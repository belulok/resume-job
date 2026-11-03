import { addAt, getAt, hasPath, parsePointer, removeAt, setAt, toPointer } from "./paths";
import { normalizeResume } from "./normalize";
import type { Resume } from "./types";

/** Edit operation produced by the AI (JSON-Patch subset, values JSON-encoded). */
export interface PatchOp {
  op: "replace" | "add" | "remove" | "move";
  path: string;
  from?: string;
  /** JSON-encoded value for replace / add. */
  value?: string;
}

export interface PatchResult {
  resume: Resume;
  applied: PatchOp[];
  errors: string[];
  /** Resolved paths of elements that were added or changed (for highlighting). */
  touched: string[];
}

function decode(value: string | undefined): unknown {
  if (value === undefined || value === "") throw new Error("missing value");
  try {
    return JSON.parse(value);
  } catch {
    // Models occasionally send a bare string instead of a JSON-encoded one.
    return value;
  }
}

function resolveAddPath(doc: unknown, path: string): string {
  const segs = parsePointer(path);
  if (segs[segs.length - 1] !== "-") return path;
  const parent = getAt<unknown[]>(doc, toPointer(segs.slice(0, -1)));
  return toPointer([...segs.slice(0, -1), Array.isArray(parent) ? parent.length : 0]);
}

export function applyOps(resume: Resume, ops: PatchOp[]): PatchResult {
  let doc: Resume = resume;
  const applied: PatchOp[] = [];
  const errors: string[] = [];
  const touched: string[] = [];

  for (const op of ops) {
    try {
      switch (op.op) {
        case "replace": {
          if (!hasPath(doc, op.path)) throw new Error("path not found");
          doc = setAt(doc, op.path, decode(op.value));
          touched.push(op.path);
          break;
        }
        case "add": {
          const resolved = resolveAddPath(doc, op.path);
          doc = addAt(doc, op.path, decode(op.value));
          touched.push(resolved);
          break;
        }
        case "remove": {
          if (!hasPath(doc, op.path)) throw new Error("path not found");
          doc = removeAt(doc, op.path);
          break;
        }
        case "move": {
          if (!op.from || !hasPath(doc, op.from)) throw new Error("from path not found");
          const value = getAt(doc, op.from);
          doc = removeAt(doc, op.from);
          const resolved = resolveAddPath(doc, op.path);
          doc = addAt(doc, op.path, value);
          touched.push(resolved);
          break;
        }
        default:
          throw new Error(`unknown op "${(op as PatchOp).op}"`);
      }
      applied.push(op);
    } catch (e) {
      errors.push(`${op.op} ${op.path}: ${(e as Error).message}`);
    }
  }

  return { resume: normalizeResume(doc), applied, errors, touched };
}
