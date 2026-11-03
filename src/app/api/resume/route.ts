import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Saved resumes live in ./data so they survive browser storage being cleared. */
const FILE = path.join(process.cwd(), "data", "resume.json");

export async function GET() {
  try {
    const raw = await readFile(FILE, "utf8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json(null);
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("resume" in body)) {
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }
  const savedAt = Date.now();
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify({ resume: body.resume, savedAt }, null, 2));
  return Response.json({ ok: true, savedAt });
}
