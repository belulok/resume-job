import { z } from "zod";
import { answerForm, FormFieldSchema } from "@/lib/jobs/apply";
import { getJob } from "@/lib/jobs/store";

const BodySchema = z.object({ fields: z.array(FormFieldSchema).min(1).max(150) });

/** Answers for an application form's fields, for the apply bot to fill in. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await getJob(id).catch(() => null);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  try {
    return Response.json({ answers: await answerForm(job, parsed.data.fields) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
