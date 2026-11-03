import { z } from "zod";
import {
  logout,
  sendLoginCode,
  submitLoginCode,
  submitPassword,
  telegramStatus,
  TelegramError,
} from "@/lib/telegram/client";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sendCode"), phone: z.string().min(6).max(20) }),
  z.object({ action: z.literal("code"), code: z.string().min(3).max(10) }),
  z.object({ action: z.literal("password"), password: z.string().min(1).max(256) }),
  z.object({ action: z.literal("logout") }),
]);

export async function GET() {
  return Response.json(await telegramStatus());
}

export async function POST(request: Request) {
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "sendCode":
        return Response.json(await sendLoginCode(body.phone));
      case "code":
        return Response.json(await submitLoginCode(body.code));
      case "password":
        return Response.json(await submitPassword(body.password));
      case "logout":
        await logout();
        return Response.json({ ok: true });
    }
  } catch (e) {
    const status = e instanceof TelegramError ? e.status : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
