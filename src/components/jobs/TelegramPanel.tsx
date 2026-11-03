"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, LogOut, Megaphone, Plus, Search, Send, Users, X } from "lucide-react";
import type { JobSettings, TelegramSourceRef } from "@/lib/jobs/types";
import { Button, cx, inputClass } from "../ui";

interface TgStatus {
  configured: boolean;
  authorized: boolean;
  me?: { name: string; username?: string; phone?: string };
  awaitingCode?: boolean;
  error?: string;
}

interface ChatInfo extends TelegramSourceRef {
  members?: number;
  unread: number;
  likelyJobs: boolean;
}

async function tgAction(body: Record<string, string>) {
  const res = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function LoginFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("+60");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone")
          run(async () => {
            const r = await tgAction({ action: "sendCode", phone });
            setInfo(r.viaApp ? "Code sent to your Telegram app (check the “Telegram” chat)." : "Code sent by SMS.");
            setStep("code");
          });
        else if (step === "code")
          run(async () => {
            const r = await tgAction({ action: "code", code });
            if (r.needPassword) {
              setHint(r.hint);
              setStep("password");
            } else onDone();
          });
        else
          run(async () => {
            await tgAction({ action: "password", password });
            onDone();
          });
      }}
    >
      {step === "phone" && (
        <>
          <label className="block text-xs text-zinc-500">Your Telegram phone number</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+60 12 345 6789" autoFocus />
        </>
      )}
      {step === "code" && (
        <>
          {info && <p className="text-xs text-emerald-700">{info}</p>}
          <label className="block text-xs text-zinc-500">Login code</label>
          <input
            className={cx(inputClass, "font-mono tracking-[0.3em]")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="12345"
            autoFocus
          />
        </>
      )}
      {step === "password" && (
        <>
          <label className="block text-xs text-zinc-500">
            Two-step verification password{hint ? ` (hint: ${hint})` : ""}
          </label>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {step === "phone" ? "Send code" : step === "code" ? "Verify" : "Sign in"}
        </Button>
        {step !== "phone" && (
          <button type="button" className="text-xs text-zinc-500 hover:text-zinc-800" onClick={() => setStep("phone")}>
            Use a different number
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-400">
        Signs in with your own account using your API ID. The session is stored only on this Mac in
        <code className="mx-0.5">data/telegram/session</code>, read-only use: the app just reads the groups you pick.
      </p>
    </form>
  );
}

function GroupPicker({
  selected,
  onClose,
  onSave,
}: {
  selected: TelegramSourceRef[];
  onClose: () => void;
  onSave: (sources: TelegramSourceRef[]) => void;
}) {
  const [chats, setChats] = useState<ChatInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Map<string, TelegramSourceRef>>(() => new Map(selected.map((s) => [s.id, s])));
  const [publicInput, setPublicInput] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/chats")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setChats(d.chats);
      })
      .catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const extra = [...picked.values()].filter((p) => !chats?.some((c) => c.id === p.id));
    const all: ChatInfo[] = [...extra.map((p) => ({ ...p, unread: 0, likelyJobs: true })), ...(chats ?? [])];
    const q = query.toLowerCase();
    return q ? all.filter((c) => c.title.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q)) : all;
  }, [chats, picked, query]);

  const toggle = (c: TelegramSourceRef) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, { id: c.id, title: c.title, username: c.username, kind: c.kind });
      return next;
    });

  const addPublic = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: publicInput }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toggle(d.chat);
      setPublicInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-6" onMouseDown={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Choose job groups to scan</h3>
            <p className="text-xs text-zinc-500">Groups and channels you&apos;re in. Likely job groups are listed first.</p>
          </div>
          <button className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2 border-b border-zinc-100 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-zinc-400" />
            <input className={cx(inputClass, "pl-8")} placeholder="Search your groups…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            <input
              className={inputClass}
              placeholder="Add a public channel: @username or t.me/link"
              value={publicInput}
              onChange={(e) => setPublicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && publicInput && addPublic()}
            />
            <Button size="md" onClick={addPublic} disabled={!publicInput || adding}>
              {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
            </Button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
          {!chats && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading your chats…
            </div>
          )}
          {shown.map((c) => {
            const on = picked.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50",
                  on && "bg-indigo-50/60 hover:bg-indigo-50",
                )}
              >
                <span
                  className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    on ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                {c.kind === "channel" ? (
                  <Megaphone className="size-4 shrink-0 text-zinc-400" />
                ) : (
                  <Users className="size-4 shrink-0 text-zinc-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-900">{c.title}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {c.username ? `@${c.username} · ` : ""}
                    {c.kind}
                    {c.members ? ` · ${c.members.toLocaleString()} members` : ""}
                  </span>
                </span>
                {c.likelyJobs && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    looks like jobs
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-zinc-100 p-3">
          <span className="text-xs text-zinc-500">{picked.size} selected</span>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave([...picked.values()])}>
            Save selection
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TelegramPanel({
  settings,
  onSettings,
}: {
  settings: JobSettings;
  onSettings: (patch: Partial<JobSettings>) => void;
}) {
  const [status, setStatus] = useState<TgStatus | null>(null);
  const [picking, setPicking] = useState(false);

  const refresh = () =>
    fetch("/api/telegram")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, authorized: false, error: "Server unavailable" }));

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-sky-500 text-white">
          <Send className="size-3.5" />
        </span>
        <h3 className="text-[13px] font-semibold text-zinc-900">Telegram</h3>
        {status?.authorized && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        )}
      </div>

      {!status && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" /> Checking connection…
        </div>
      )}
      {status && !status.configured && (
        <p className="text-xs text-rose-600">Add TELEGRAM_API_ID and TELEGRAM_API_HASH to .env.local and restart the server.</p>
      )}
      {status?.configured && !status.authorized && <LoginFlow onDone={refresh} />}
      {status?.authorized && (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              <b className="text-zinc-800">{status.me?.name}</b>
              <span className="text-zinc-500">
                {status.me?.username ? ` @${status.me.username}` : ""} {status.me?.phone}
              </span>
            </span>
            <button
              className="flex items-center gap-1 text-zinc-500 hover:text-rose-600"
              title="Log out and delete the local session"
              onClick={async () => {
                if (!confirm("Disconnect Telegram? This logs this app out and deletes the local session.")) return;
                await tgAction({ action: "logout" });
                refresh();
              }}
            >
              <LogOut className="size-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Scanning {settings.sources.length} {settings.sources.length === 1 ? "group" : "groups"}
            </span>
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => setPicking(true)}>
              Choose groups
            </button>
          </div>
          {settings.sources.length === 0 ? (
            <button
              onClick={() => setPicking(true)}
              className="mt-1.5 w-full rounded-lg border border-dashed border-zinc-300 py-3 text-xs text-zinc-500 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
            >
              Pick the job groups you&apos;re in
            </button>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {settings.sources.map((s) => (
                <span key={s.id} className="flex max-w-full items-center gap-1 rounded-full bg-sky-50 py-0.5 pl-2 pr-1 text-[11px] text-sky-800">
                  <span className="truncate">{s.title}</span>
                  <button
                    className="rounded-full p-0.5 hover:bg-sky-100"
                    onClick={() => onSettings({ sources: settings.sources.filter((x) => x.id !== s.id) })}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {status?.error && status.configured && !status.authorized && (
        <p className="mt-2 text-[11px] text-rose-600">{status.error}</p>
      )}
      {picking && (
        <GroupPicker
          selected={settings.sources}
          onClose={() => setPicking(false)}
          onSave={(sources) => {
            onSettings({ sources });
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}
