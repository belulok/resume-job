import { enqueueTailor } from "@/lib/jobs/runner";
import { getJob, saveJob } from "@/lib/jobs/store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await getJob(id).catch(() => null);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  job.status = "queued";
  await saveJob(job);
  enqueueTailor(id);
  return Response.json({ queued: true }, { status: 202 });
}
