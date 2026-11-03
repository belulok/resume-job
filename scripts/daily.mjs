/**
 * Optional: run the job scan every day via macOS launchd, even when the web app is closed.
 *   npm run jobs:daily:install     (uses the time set on the Jobs page, default 09:00)
 *   npm run jobs:daily:uninstall
 * While the web app is running it also scans daily on its own; both share a lock, so they never overlap.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const LABEL = "com.my-cv.jobscan";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const plist = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const uid = process.getuid();

function settingsTime() {
  try {
    const s = JSON.parse(readFileSync(path.join(root, "data/jobs/settings.json"), "utf8"));
    const [h, m] = (s.schedule?.time ?? "09:00").split(":").map(Number);
    return { h: h || 9, m: m || 0 };
  } catch {
    return { h: 9, m: 0 };
  }
}

const cmd = process.argv[2];
if (process.platform !== "darwin") {
  console.error("launchd scheduling is macOS-only. Use cron: `cd " + root + " && npm run jobs:scan`.");
  process.exit(1);
}

if (cmd === "install") {
  const { h, m } = settingsTime();
  const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const log = path.join(root, "data", "jobs", "scan.log");
  mkdirSync(path.dirname(log), { recursive: true });
  mkdirSync(path.dirname(plist), { recursive: true });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${process.execPath}</string><string>${tsx}</string><string>scripts/scan.mts</string>
  </array>
  <key>WorkingDirectory</key><string>${root}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${path.dirname(process.execPath)}:${os.homedir()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>${m}</integer></dict>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict></plist>
`,
  );
  try {
    execFileSync("launchctl", ["bootout", `gui/${uid}/${LABEL}`], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["bootstrap", `gui/${uid}`, plist]);
  console.log(`Installed: daily job scan at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} → log: ${log}`);
} else if (cmd === "uninstall") {
  try {
    execFileSync("launchctl", ["bootout", `gui/${uid}/${LABEL}`], { stdio: "ignore" });
  } catch {}
  if (existsSync(plist)) rmSync(plist);
  console.log("Removed the daily job scan.");
} else {
  console.log("Usage: node scripts/daily.mjs install|uninstall");
}
