import { z } from "zod";
import { readSettings, writeSettings } from "@/lib/jobs/store";

const SettingsSchema = z.object({
  sources: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        username: z.string().optional(),
        kind: z.enum(["group", "channel"]),
      }),
    )
    .max(100),
  schedule: z.object({ enabled: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  lookbackDays: z.number().int().min(1).max(30),
  field: z.string().max(2000),
  location: z.string().max(1000),
  minRelevance: z.number().int().min(0).max(100),
  targetScore: z.number().int().min(50).max(100),
  maxJobsPerScan: z.number().int().min(1).max(50),
  extraFacts: z.string().max(10_000),
});

export async function GET() {
  return Response.json(await readSettings());
}

export async function PUT(request: Request) {
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });
  await writeSettings(parsed.data);
  return Response.json(parsed.data);
}
