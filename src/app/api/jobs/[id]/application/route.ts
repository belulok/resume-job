import { z } from "zod";
import { launchBot, liveRun, saveAnswers, stopBot } from "@/lib/jobs/apply";
import { getJob, saveJob } from "@/lib/jobs/store";

async function load(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return getJob(id).catch(() => null);
}

/** Starting the bot launches a local process: only from CV Studio's own pages (the bot itself sends no Origin). */
function crossSite(request: Request) {
  const origin = request.headers.get("origin");
  return (origin && origin !== new URL(request.url).origin) || !request.headers.get("content-type")?.includes("application/json");
}

/** Open the job in Chrome with the apply bot: fill the application (`apply`) or only read the job page (`read`). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const job = await load(ctx);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const body = z.object({ mode: z.enum(["apply", "read"]) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "mode must be apply or read." }, { status: 400 });
  if (!job.applyUrl) return Response.json({ error: "This job has no job page link." }, { status: 400 });
  try {
    job.application = await launchBot(job, body.data.mode, new URL(request.url).origin);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
  await saveJob(job);
  return Response.json(job.application, { status: 202 });
}

const ReportSchema = z.object({
  state: z.enum(["running", "waiting", "review", "submitted", "done", "failed", "stopped"]),
  message: z.string().max(1000),
  needsYou: z.array(z.string().max(300)).max(100).optional(),
  filled: z.number().int().optional(),
  /** Answers the candidate typed themselves, to reuse on later forms. */
  answers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(5000) })).max(100).optional(),
});

/** Progress reports from the bot. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = await load(ctx);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = ReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid report." }, { status: 400 });
  const { answers, ...report } = parsed.data;
  const now = new Date().toISOString();
  job.application = { mode: "apply", startedAt: now, ...job.application, ...report, updatedAt: now };
  if (report.state === "submitted") job.status = "applied";
  if (answers?.length) await saveAnswers(answers);
  await saveJob(job);
  return Response.json({ ok: true });
}

/** Stop the bot and close its Chrome window. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = await load(ctx);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const run = liveRun(job.application);
  stopBot(run);
  if (run && ["running", "waiting", "review"].includes(run.state)) {
    job.application = { ...run, state: "stopped", message: "Stopped.", updatedAt: new Date().toISOString() };
    await saveJob(job);
  }
  return Response.json({ ok: true });
}
