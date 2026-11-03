import { hasSession, telegramConfigured } from "@/lib/telegram/client";
import { isScanRunning, runScan, tailorJob } from "./scan";
import { localDate, readSettings, readState, updateState } from "./store";

/** Background work inside the Next.js server process (fire-and-forget from route handlers). */

interface RunnerGlobal {
  tailorChain: Promise<unknown>;
  scheduler?: ReturnType<typeof setInterval>;
}
const g = globalThis as unknown as { __jobRunner?: RunnerGlobal };
const runner: RunnerGlobal = (g.__jobRunner ??= { tailorChain: Promise.resolve() });

export async function startScan(trigger: "manual" | "schedule", opts: { days?: number } = {}) {
  if (await isScanRunning()) return { started: false, reason: "A scan is already running." };
  runScan(trigger, opts).catch((e) => console.error("[jobs] scan failed", e));
  return { started: true };
}

/** Tailoring requests run one at a time so the AI provider isn't flooded. */
export function enqueueTailor(id: string) {
  runner.tailorChain = runner.tailorChain
    .then(() => tailorJob(id))
    .catch((e) => console.error("[jobs] tailor failed", id, e));
}

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function nextRunAt(time: string, lastRunDate?: string): string {
  const now = new Date();
  const slot = new Date(now);
  slot.setHours(0, minutesOf(time), 0, 0);
  if (lastRunDate === localDate(now)) {
    slot.setDate(slot.getDate() + 1);
    return slot.toISOString();
  }
  // Today's slot already passed without a run → due now.
  return (slot < now ? now : slot).toISOString();
}

async function tick() {
  try {
    const settings = await readSettings();
    if (!settings.schedule.enabled || !settings.sources.length) return;
    if (!telegramConfigured() || !(await hasSession())) return;
    const state = await readState();
    const now = new Date();
    if (state.lastRunDate === localDate(now)) return;
    if (now.getHours() * 60 + now.getMinutes() < minutesOf(settings.schedule.time)) return;
    if (await isScanRunning()) return;
    console.log("[jobs] daily scan starting");
    await startScan("schedule");
  } catch (e) {
    console.error("[jobs] scheduler tick failed", e);
  }
}

/** Checks every 5 minutes; a missed slot (app was closed) runs as soon as the app is up. */
export function startScheduler() {
  if (runner.scheduler) return;
  runner.scheduler = setInterval(tick, 5 * 60 * 1000);
  setTimeout(tick, 45_000);
  // Clear a lock left behind by a crashed process.
  updateState((s) => {
    if (s.running && s.running.pid === process.pid) s.running = undefined;
  }).catch(() => {});
}
