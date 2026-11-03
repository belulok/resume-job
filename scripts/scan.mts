/**
 * Standalone daily scan (no web server needed): `npm run jobs:scan`.
 * `npm run jobs:scan -- --days 30` re-reads the last 30 days.
 * Used by the optional launchd agent (`npm run jobs:daily:install`).
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { runScan } = await import("../src/lib/jobs/scan");
const daysArg = process.argv.indexOf("--days");
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : undefined;
const result = await runScan("cli", { days: days && days > 0 ? days : undefined });
console.log(JSON.stringify(result, null, 2));
process.exit(result.errors.length && !result.jobsFound ? 1 : 0);
