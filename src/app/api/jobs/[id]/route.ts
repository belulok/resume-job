import { z } from "zod";
import { liveRun } from "@/lib/jobs/apply";
import { scoreResume } from "@/lib/jobs/score";
import { deleteJob, getJob, saveJob } from "@/lib/jobs/store";
import { normalizeResume } from "@/lib/resume/normalize";

const PatchSchema = z.object({
  status: z.enum(["ready", "partial", "skipped", "applied", "dismissed"]).optional(),
  resume: z.record(z.string(), z.unknown()).optional(),
});

async function load(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return await getJob(id);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = await load(ctx);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...job, application: liveRun(job.application) });
}

/** Update status, or save edits made to the tailored resume in the editor. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = await load(ctx);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid body." }, { status: 400 });
  if (parsed.data.status) job.status = parsed.data.status;
  if (parsed.data.resume) {
    job.resume = normalizeResume(parsed.data.resume);
    const s = scoreResume(job.resume, job.keywords);
    job.score = s.score;
    job.matched = s.matched;
    job.missing = s.missing;
  }
  await saveJob(job);
  return Response.json({ ok: true, score: job.score, updatedAt: job.updatedAt });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteJob(id).catch(() => {});
  return Response.json({ ok: true });
}
