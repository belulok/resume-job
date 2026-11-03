import { z } from "zod";
import { readProfile, writeProfile } from "@/lib/jobs/store";

const field = z.string().max(500);
const ProfileSchema = z.object({
  firstName: field,
  lastName: field,
  email: field,
  phone: field,
  city: field,
  country: field,
  linkedin: field,
  github: field,
  website: field,
  noticePeriod: field,
  salaryExpectation: field,
  workAuthorization: z.string().max(2000),
  answers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(5000) })).max(200),
});

/** The details application forms ask for (see Settings → Application profile). */
export async function GET() {
  return Response.json(await readProfile());
}

export async function PUT(request: Request) {
  const parsed = ProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile." }, { status: 400 });
  await writeProfile(parsed.data);
  return Response.json(parsed.data);
}
