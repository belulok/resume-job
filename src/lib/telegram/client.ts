import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Api, sessions, TelegramClient } from "telegram";
import type { LogLevel } from "telegram/extensions/Logger";

// Import from the package root only: Node can't resolve "telegram/sessions" (a directory) when externalized.
const { StringSession } = sessions;
type StringSession = InstanceType<typeof sessions.StringSession>;
import { DATA_DIR } from "@/lib/jobs/store";
import type { TelegramSourceRef } from "@/lib/jobs/types";

/*
 * Telegram user-account access (MTProto via GramJS). The session string grants
 * full access to the account, so it is stored only in ./data/telegram/session
 * with 0600 permissions and never sent to the browser.
 */

const SESSION_FILE = path.join(DATA_DIR, "telegram", "session");

interface TgGlobal {
  client?: TelegramClient;
  connecting?: Promise<TelegramClient>;
  login?: { phone: string; phoneCodeHash: string };
}
const g = globalThis as unknown as { __telegram?: TgGlobal };
const tg: TgGlobal = (g.__telegram ??= {});

export class TelegramError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function credentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  if (!apiId || !apiHash) {
    throw new TelegramError("TELEGRAM_API_ID / TELEGRAM_API_HASH are missing from .env.local.", 501);
  }
  return { apiId, apiHash };
}

export function telegramConfigured() {
  return Boolean(Number(process.env.TELEGRAM_API_ID) && process.env.TELEGRAM_API_HASH);
}

async function readSession() {
  try {
    return (await readFile(SESSION_FILE, "utf8")).trim();
  } catch {
    return "";
  }
}

async function persistSession(client: TelegramClient) {
  const value = (client.session as StringSession).save();
  await mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await writeFile(SESSION_FILE, value, { mode: 0o600 });
  await chmod(SESSION_FILE, 0o600);
}

export async function hasSession() {
  return (await readSession()).length > 0;
}

async function getClient(): Promise<TelegramClient> {
  if (tg.client?.connected) return tg.client;
  if (tg.connecting) return tg.connecting;
  const { apiId, apiHash } = credentials();
  tg.connecting = (async () => {
    const client = new TelegramClient(new StringSession(await readSession()), apiId, apiHash, {
      connectionRetries: 5,
      floodSleepThreshold: 120,
    });
    client.setLogLevel("error" as LogLevel);
    await client.connect();
    tg.client = client;
    return client;
  })().finally(() => {
    tg.connecting = undefined;
  });
  return tg.connecting;
}

function errorCode(e: unknown): string {
  return (e as { errorMessage?: string })?.errorMessage ?? (e as Error)?.message ?? String(e);
}

export interface TelegramStatus {
  configured: boolean;
  authorized: boolean;
  me?: { name: string; username?: string; phone?: string };
  awaitingCode?: boolean;
  error?: string;
}

export async function telegramStatus(): Promise<TelegramStatus> {
  if (!telegramConfigured()) return { configured: false, authorized: false };
  if (!(await hasSession()) && !tg.login) return { configured: true, authorized: false };
  try {
    const client = await getClient();
    if (!(await client.checkAuthorization())) {
      return { configured: true, authorized: false, awaitingCode: !!tg.login };
    }
    const me = await client.getMe();
    const phone = me.phone ? `+${me.phone.slice(0, 3)}•••${me.phone.slice(-3)}` : undefined;
    return {
      configured: true,
      authorized: true,
      me: { name: [me.firstName, me.lastName].filter(Boolean).join(" "), username: me.username, phone },
    };
  } catch (e) {
    return { configured: true, authorized: false, error: errorCode(e) };
  }
}

export async function sendLoginCode(phone: string) {
  const client = await getClient();
  const cleaned = phone.replace(/[^\d+]/g, "");
  try {
    const { phoneCodeHash, isCodeViaApp } = await client.sendCode(credentials(), cleaned);
    tg.login = { phone: cleaned, phoneCodeHash };
    return { sent: true, viaApp: isCodeViaApp };
  } catch (e) {
    throw new TelegramError(`Could not send the code: ${errorCode(e)}`);
  }
}

export async function submitLoginCode(code: string): Promise<{ authorized: boolean; needPassword?: boolean; hint?: string }> {
  if (!tg.login) throw new TelegramError("Request a login code first.");
  const client = await getClient();
  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: tg.login.phone,
        phoneCodeHash: tg.login.phoneCodeHash,
        phoneCode: code.replace(/\D/g, ""),
      }),
    );
  } catch (e) {
    const code = errorCode(e);
    if (code.includes("SESSION_PASSWORD_NEEDED")) {
      const pw = await client.invoke(new Api.account.GetPassword()).catch(() => null);
      return { authorized: false, needPassword: true, hint: pw?.hint ?? undefined };
    }
    if (code.includes("PHONE_CODE_INVALID")) throw new TelegramError("That code is not valid. Check it and try again.");
    if (code.includes("PHONE_CODE_EXPIRED")) throw new TelegramError("The code expired. Request a new one.");
    throw new TelegramError(`Sign-in failed: ${code}`);
  }
  tg.login = undefined;
  await persistSession(client);
  return { authorized: true };
}

export async function submitPassword(password: string) {
  const client = await getClient();
  let failure: unknown;
  try {
    await client.signInWithPassword(credentials(), {
      password: async () => password,
      onError: async (e) => {
        failure = e;
        return true; // stop retrying
      },
    });
  } catch (e) {
    failure ??= e;
  }
  if (!(await client.checkAuthorization())) {
    const code = errorCode(failure);
    throw new TelegramError(code.includes("PASSWORD_HASH_INVALID") ? "Wrong 2FA password." : `Sign-in failed: ${code}`);
  }
  tg.login = undefined;
  await persistSession(client);
  return { authorized: true };
}

export async function logout() {
  try {
    const client = await getClient();
    if (await client.checkAuthorization()) await client.invoke(new Api.auth.LogOut());
    await client.disconnect();
  } catch {
    // ignore — we drop the local session regardless
  }
  tg.client = undefined;
  tg.login = undefined;
  await rm(SESSION_FILE, { force: true });
}

async function authorizedClient() {
  const client = await getClient();
  if (!(await client.checkAuthorization())) {
    throw new TelegramError("Telegram is not connected. Log in on the Jobs page first.", 401);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Chats & messages
// ---------------------------------------------------------------------------

const JOBISH_TITLE =
  /job|jobs|career|hiring|hire|vacanc|recruit|kerja|jawatan|kosong|remote|freelance|gig|developer|dev\b|engineer|tech|startup|it\b|software|web3|crypto|ai\b|intern/i;

export interface ChatInfo extends TelegramSourceRef {
  members?: number;
  unread: number;
  likelyJobs: boolean;
}

function chatKind(entity: unknown): "group" | "channel" {
  return entity instanceof Api.Channel && entity.broadcast ? "channel" : "group";
}

export async function listChats(): Promise<ChatInfo[]> {
  const client = await authorizedClient();
  const dialogs = await client.getDialogs({ limit: 500 });
  return dialogs
    .filter((d) => d.isGroup || d.isChannel)
    .map((d) => {
      const entity = d.entity as Api.Channel | Api.Chat | undefined;
      const title = d.title ?? d.name ?? "Untitled";
      return {
        id: d.id!.toString(),
        title,
        username: entity instanceof Api.Channel ? (entity.username ?? undefined) : undefined,
        kind: chatKind(entity),
        members: (entity as { participantsCount?: number })?.participantsCount ?? undefined,
        unread: d.unreadCount,
        likelyJobs: JOBISH_TITLE.test(title),
      };
    })
    .sort((a, b) => Number(b.likelyJobs) - Number(a.likelyJobs) || a.title.localeCompare(b.title));
}

/** Resolve a public @username or t.me link into a source. */
export async function resolveChat(input: string): Promise<ChatInfo> {
  const client = await authorizedClient();
  const username = input
    .trim()
    .replace(/^https?:\/\/(t|telegram)\.me\//i, "")
    .replace(/^@/, "")
    .split(/[/?]/)[0];
  if (!/^[A-Za-z0-9_]{4,}$/.test(username)) throw new TelegramError("Enter a public @username or a t.me/... link.");
  try {
    const entity = await client.getEntity(username);
    if (!(entity instanceof Api.Channel) && !(entity instanceof Api.Chat)) {
      throw new TelegramError("That is a user, not a group or channel.");
    }
    const id = (await client.getPeerId(entity)).toString();
    return {
      id,
      title: entity.title,
      username: entity instanceof Api.Channel ? (entity.username ?? username) : undefined,
      kind: chatKind(entity),
      unread: 0,
      likelyJobs: true,
    };
  } catch (e) {
    if (e instanceof TelegramError) throw e;
    throw new TelegramError(`Could not find "${username}": ${errorCode(e)}`);
  }
}

export interface TgMessage {
  id: number;
  date: string;
  text: string;
  link?: string;
}

function messageText(m: Api.Message): string {
  let text = m.message ?? "";
  const urls = (m.entities ?? [])
    .filter((e): e is Api.MessageEntityTextUrl => e instanceof Api.MessageEntityTextUrl)
    .map((e) => e.url);
  if (urls.length) text += `\n\nLinks: ${[...new Set(urls)].join(" ")}`;
  return text.trim();
}

function messageLink(entity: unknown, id: number): string | undefined {
  if (entity instanceof Api.Channel) {
    return entity.username ? `https://t.me/${entity.username}/${id}` : `https://t.me/c/${entity.id.toString()}/${id}`;
  }
  return undefined;
}

export interface FetchResult {
  messages: TgMessage[];
  maxId: number;
}

/**
 * Messages newer than `minId` (or, on a first scan, posted within `lookbackDays`).
 * Dialog entities are loaded first so private chats resolve by id.
 */
export async function fetchNewMessages(
  sources: TelegramSourceRef[],
  cursors: Record<string, number>,
  lookbackDays: number,
  onProgress?: (source: TelegramSourceRef, i: number) => void,
): Promise<Map<string, FetchResult & { error?: string }>> {
  const client = await authorizedClient();
  const dialogs = await client.getDialogs({ limit: 500 });
  const byId = new Map(dialogs.map((d) => [d.id?.toString(), d.entity]));
  const since = Date.now() / 1000 - lookbackDays * 86400;
  const out = new Map<string, FetchResult & { error?: string }>();

  for (const [i, source] of sources.entries()) {
    onProgress?.(source, i);
    const minId = cursors[source.id] ?? 0;
    try {
      const entity = byId.get(source.id) ?? (source.username ? await client.getEntity(source.username) : undefined);
      if (!entity) throw new Error("chat not found (left the group?)");
      const messages: TgMessage[] = [];
      let maxId = minId;
      // First scans stop at the lookback date; the limit only caps very busy channels.
      for await (const m of client.iterMessages(entity, { limit: minId ? 400 : 5000, minId })) {
        if (!(m instanceof Api.Message)) continue;
        maxId = Math.max(maxId, m.id);
        if (!minId && m.date < since) break;
        const text = messageText(m);
        if (text) {
          messages.push({
            id: m.id,
            date: new Date(m.date * 1000).toISOString(),
            text,
            link: messageLink(entity, m.id),
          });
        }
      }
      out.set(source.id, { messages, maxId });
    } catch (e) {
      out.set(source.id, { messages: [], maxId: minId, error: errorCode(e) });
    }
  }
  return out;
}
