import { listChats, resolveChat, TelegramError } from "@/lib/telegram/client";

function fail(e: unknown) {
  const status = e instanceof TelegramError ? e.status : 500;
  return Response.json({ error: (e as Error).message }, { status });
}

export async function GET() {
  try {
    return Response.json({ chats: await listChats() });
  } catch (e) {
    return fail(e);
  }
}

/** Resolve a public @username / t.me link that you haven't joined. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.input !== "string") return Response.json({ error: "Missing input." }, { status: 400 });
  try {
    return Response.json({ chat: await resolveChat(body.input) });
  } catch (e) {
    return fail(e);
  }
}
