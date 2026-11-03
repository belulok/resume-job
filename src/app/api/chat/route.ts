import { z } from "zod";
import { buildUserContent, ChatResponseSchema, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { detectProvider, ProviderError, runStructured } from "@/lib/ai/provider";

const BodySchema = z.object({
  resume: z.record(z.string(), z.unknown()),
  message: z.string().min(1).max(20_000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(40)
    .default([]),
  selection: z
    .object({ path: z.string(), label: z.string(), value: z.unknown() })
    .nullable()
    .default(null),
  job: z
    .object({
      title: z.string(),
      company: z.string().optional(),
      description: z.string().max(20_000),
      missingKeywords: z.array(z.string()).optional(),
    })
    .nullable()
    .default(null),
});

export async function GET() {
  return Response.json(detectProvider());
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { resume, message, history, selection, job } = parsed.data;

  try {
    const result = await runStructured({
      system: SYSTEM_PROMPT,
      history,
      user: buildUserContent(resume, message, selection, job),
      schema: ChatResponseSchema,
    });
    return Response.json(result);
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("[api/chat]", message);
    return Response.json({ error: message }, { status });
  }
}
