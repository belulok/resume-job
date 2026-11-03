import { z } from "zod";
import { startScan } from "@/lib/jobs/runner";

const ScanSchema = z.object({ days: z.number().int().min(1).max(90).optional() });

/** Start a scan. `{ days }` re-reads the last N days instead of only new messages. */
export async function POST(request: Request) {
  const parsed = ScanSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ started: false, reason: "days must be 1–90." }, { status: 400 });
  const result = await startScan("manual", parsed.data);
  return Response.json(result, { status: result.started ? 202 : 409 });
}
