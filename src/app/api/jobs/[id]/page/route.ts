import { z } from "zod";
import { enqueueTailor } from "@/lib/jobs/runner";
import { getJob, loadBaseResume, readSettings, saveJob } from "@/lib/jobs/store";
import { applyPageRead, readJobPages } from "@/lib/jobs/verify";

const BodySchema = z.object({
  text: z.string().min(80).max(60_000),
  source: z.enum(["page", "pasted"]),
});

/**
 * The job's page as the apply bot read it in the candidate's Chrome, or a description they pasted.
 * A full description replaces the post's and the CV is re-tailored to it.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await getJob(id).catch(() => null);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send the job page text (at least 80 characters)." }, { status: 400 });

  const settings = await readSettings();
  const { source } = parsed.data;
  const read = (await readJobPages([{ job, text: parsed.data.text }], settings.location)).get(job.id)!;
  // A full description is read once; opening the page again only refreshes where the job is based. Pasting replaces it.
  const hasFull = job.descriptionSource === "page" || job.descriptionSource === "pasted";
  const status = job.status;
  const updated = applyPageRead(job, hasFull && source === "page" ? { ...read, description: "", keywords: [] } : read, await loadBaseResume(), source);
  // The candidate opened this job themselves: show what the page says, but don't hide it from them.
  if (job.status === "dismissed" && status !== "dismissed") job.status = status;
  if (updated) job.status = "queued";
  await saveJob(job);
  if (updated) enqueueTailor(job.id);
  return Response.json({ updated, retailoring: updated, check: read.check });
}
