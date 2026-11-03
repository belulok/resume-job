import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export type ProviderKind = "anthropic-api" | "claude-cli" | "none";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const API_MODEL = process.env.CV_AI_MODEL || "claude-opus-5-5";
const CLI_TIMEOUT_MS = 300_000;

export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

function hasApiCredentials() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      existsSync(path.join(os.homedir(), ".config", "anthropic")),
  );
}

function findClaudeCli(): string | null {
  const candidates = [
    process.env.CLAUDE_CLI_PATH,
    path.join(os.homedir(), ".local", "bin", "claude"),
    path.join(os.homedir(), ".claude", "local", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, "claude"));
  }
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export function detectProvider(): { kind: ProviderKind; label: string } {
  if (hasApiCredentials()) return { kind: "anthropic-api", label: `Claude API · ${API_MODEL}` };
  if (findClaudeCli()) return { kind: "claude-cli", label: "Claude Code (local CLI)" };
  return { kind: "none", label: "Not configured" };
}

export interface StructuredRequest<S extends z.ZodType<object>> {
  system: string;
  /** Earlier conversation turns (optional). */
  history?: ChatTurn[];
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
}

/** Collapse the conversation into user/assistant messages (consecutive same-role turns are fine). */
function toMessages(history: ChatTurn[], user: string): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of history) {
    if (!messages.length && turn.role === "assistant") continue;
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: user });
  return messages;
}

async function runWithApi<S extends z.ZodType<object>>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: API_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: req.effort ?? "medium",
        format: betaZodOutputFormat(req.schema),
      },
      system: req.system,
      messages: toMessages(req.history ?? [], req.user),
    });
    if (response.stop_reason === "refusal") {
      throw new ProviderError(response.stop_details?.explanation || "The model declined this request.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new ProviderError("The response was too long. Try a more focused request.", 422);
    }
    if (!response.parsed_output) throw new ProviderError("The model returned an unreadable response.");
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ProviderError("Anthropic API key is invalid. Check ANTHROPIC_API_KEY in .env.local.", 401);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ProviderError("Rate limited by the Anthropic API — try again in a moment.", 429);
    }
    if (error instanceof Anthropic.APIError) {
      throw new ProviderError(`Anthropic API error ${error.status ?? ""}: ${error.message}`, 502);
    }
    throw error;
  }
}

function transcriptForCli(history: ChatTurn[], user: string): string {
  if (!history.length) return user;
  const prior = history.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n");
  return `<previous_conversation>\n${prior}\n</previous_conversation>\n\n${user}`;
}

async function runWithCli<S extends z.ZodType<object>>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  const cli = findClaudeCli();
  if (!cli) throw new ProviderError("Claude CLI not found.", 501);

  const args = [
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--json-schema",
    // The CLI's validator doesn't know the draft-2020-12 meta-schema URI.
    JSON.stringify({ ...z.toJSONSchema(req.schema), $schema: undefined }),
    "--system-prompt",
    req.system,
  ];
  if (process.env.CV_AI_MODEL) args.push("--model", process.env.CV_AI_MODEL);

  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(cli, args, { cwd: os.tmpdir(), env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new ProviderError("Claude CLI timed out.", 504));
    }, CLI_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ProviderError(`Could not start Claude CLI: ${e.message}`, 502));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || out.trim().startsWith("{")) resolve(out);
      else reject(new ProviderError(`Claude CLI exited with code ${code}: ${(err || out).slice(0, 400)}`, 502));
    });
    child.stdin.end(transcriptForCli(req.history ?? [], req.user));
  });

  let payload: { is_error?: boolean; result?: string; structured_output?: unknown };
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new ProviderError("Claude CLI returned invalid JSON.", 502);
  }
  if (payload.is_error) throw new ProviderError(`Claude CLI: ${payload.result ?? "unknown error"}`, 502);

  let candidate = payload.structured_output;
  if (!candidate && payload.result) {
    const match = payload.result.match(/\{[\s\S]*\}/);
    if (match) candidate = JSON.parse(match[0]);
  }
  const parsed = req.schema.safeParse(candidate);
  if (!parsed.success) throw new ProviderError("The model returned an unreadable response.", 502);
  return parsed.data;
}

/** One structured-output call to Claude via the API (if configured) or the local Claude Code CLI. */
export async function runStructured<S extends z.ZodType<object>>(
  req: StructuredRequest<S>,
): Promise<z.infer<S> & { provider: ProviderKind }> {
  const { kind } = detectProvider();
  if (kind === "anthropic-api") return { ...(await runWithApi(req)), provider: kind };
  if (kind === "claude-cli") return { ...(await runWithCli(req)), provider: kind };
  throw new ProviderError(
    "AI is not configured. Add ANTHROPIC_API_KEY to .env.local (or install the Claude Code CLI) and restart the dev server.",
    501,
  );
}
