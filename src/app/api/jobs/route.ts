import { liveRun } from "@/lib/jobs/apply";
import { enqueueTailor, nextRunAt } from "@/lib/jobs/runner";
import { createManualJob, isScanRunning } from "@/lib/jobs/scan";
import { listJobs, readSettings, readState } from "@/lib/jobs/store";

/** Jobs list + settings + scan state in one call (the Jobs page polls this). */
export async function GET() {
  const [jobs, settings, state, running] = await Promise.all([listJobs(), readSettings(), readState(), isScanRunning()]);
  return Response.json({
    jobs: jobs.map((j) => (j.application ? { ...j, application: liveRun(j.application) } : j)),
    settings,
    scan: {
      running: running ? state.running : null,
      lastRunAt: state.lastRunAt ?? null,
      lastResult: state.lastResult ?? null,
      nextRunAt: settings.schedule.enabled ? nextRunAt(settings.schedule.time, state.lastRunDate) : null,
      log: state.log.slice(-15),
    },
  });
}

/** Paste a job description manually. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return Response.json({ error: "Paste the full job description." }, { status: 400 });
  try {
    const job = await createManualJob(text.slice(0, 15000));
    enqueueTailor(job.id);
    return Response.json({ id: job.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
