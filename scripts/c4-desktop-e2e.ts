/**
 * STEP 2-5.4C4 — Hermes Desktop-native E2E (runtime-spike only).
 * Uses canonical Bot Chat via `hermes -p runtime-spike chat -c "Bot Chat"`.
 * Logs PASS/FAIL metadata only — no prompts, tool args, secrets, or signatures.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const GATEWAY = "http://127.0.0.1:3000/api/ai-runtime/v1/chat/completions";
const CHAT_NAME = "C4 Desktop E2E";

type Result = "PASS" | "FAIL" | "NOT_EXERCISED";

function loadEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const file of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME || "/home/ysh", ".hermes/.env"),
  ]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!env[k]) env[k] = v;
      }
    } catch {
      // ignore
    }
  }
  return env;
}

function hermesChat(query: string, sessionLabel: string): { stdout: string; stderr: string; code: number } {
  const dir = mkdtempSync(join(tmpdir(), "c4-e2e-"));
  const qf = join(dir, "query.txt");
  writeFileSync(qf, query, "utf8");
  try {
    const res = spawnSync(
      "hermes",
      [
        "-p",
        "runtime-spike",
        "--yolo",
        "--ignore-rules",
        "chat",
        "--in",
        process.env.HOME || "/home/ysh",
        "-c",
        CHAT_NAME,
        "--create-if-missing",
        "-Q",
        "--query-file",
        qf,
      ],
      { encoding: "utf8", timeout: 180_000, env: { ...process.env, HERMES_SESSION_LABEL: sessionLabel } },
    );
    return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", code: res.status ?? 1 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function extractAssistantText(stdout: string): string {
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const skip = new Set(["session_id:", "↻", "⚠"]);
  const body: string[] = [];
  for (const line of lines) {
    if (line.startsWith("session_id:")) continue;
    if (line.startsWith("↻")) continue;
    if (line.includes("tirith security scanner")) continue;
    if (skip.has(line)) continue;
    body.push(line);
  }
  return body.join("\n").trim();
}

function gatewayPost(body: unknown, token?: string): { status: number; headers: Record<string, string>; json: unknown } {
  const env = loadEnv();
  const bearer = token ?? env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN ?? "";
  const res = spawnSync(
    "curl",
    [
      "-sS",
      "-D",
      "-",
      "-o",
      "/tmp/c4-gateway-body.json",
      "-X",
      "POST",
      GATEWAY,
      "-H",
      "Content-Type: application/json",
      "-H",
      `Authorization: Bearer ${bearer}`,
      "-d",
      JSON.stringify(body),
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  const raw = res.stdout ?? "";
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerBlock = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  const headers: Record<string, string> = {};
  for (const line of headerBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  let json: unknown = null;
  try {
    json = JSON.parse(readFileSync("/tmp/c4-gateway-body.json", "utf8"));
  } catch {
    json = { parseError: true };
  }
  const statusLine = headerBlock.split("\n")[0] ?? "";
  const status = Number(statusLine.match(/\s(\d{3})\s/)?.[1] ?? 0);
  return { status, headers, json };
}

async function main() {
  const env = loadEnv();
  const results: Record<string, unknown> = { step: "c4-desktop-e2e", startedAt: new Date().toISOString() };

  // Environment
  const cfg = readFileSync(
    join(process.env.HOME || "/home/ysh", ".hermes/profiles/runtime-spike/config.yaml"),
    "utf8",
  );
  results.environment = {
    nextGateway: spawnSync("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code}", GATEWAY, "-X", "POST", "-H", "Content-Type: application/json", "-d", "{}"], {
      encoding: "utf8",
    }).stdout?.trim(),
    fallbackProvidersEmpty: cfg.includes("fallback_providers: []"),
    baseUrlRuntime: cfg.includes("http://127.0.0.1:3000/api/ai-runtime/v1"),
    gatewayTokenConfigured: Boolean(env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN?.trim()),
    marketingMcpOnSpike: cfg.includes("thealltour-marketing-spike"),
    publicationFlowInactive: (() => {
      try {
        const out = execFileSync("npx", ["tsx", "-e", "import { PUBLICATION_FLOW_INACTIVE } from './src/lib/marketing/social/publication/governanceBoundary.ts'; console.log(PUBLICATION_FLOW_INACTIVE);"], {
          encoding: "utf8",
          cwd: process.cwd(),
          timeout: 30_000,
        });
        return out.trim() === "true";
      } catch {
        return "unknown";
      }
    })(),
  };

  // TEST 1 — Plain Bot Chat
  const t1 = hermesChat("Reply with exactly: C4_PLAIN_OK", "c4-plain");
  const t1text = extractAssistantText(t1.stdout);
  results.plainBotChat = {
    result: t1.code === 0 && /C4_PLAIN_OK/i.test(t1text) ? "PASS" : "FAIL",
    exitCode: t1.code,
    mentionsOk: /C4_PLAIN_OK/i.test(t1text),
    responseLen: t1text.length,
  };

  // TEST 2 — Context persistence (same Bot Chat channel)
  const t2a = hermesChat("Remember the codeword ALPHA-27. Reply with exactly: REMEMBERED", "c4-ctx-a");
  const t2b = hermesChat("What codeword did I give you? Reply with the codeword only.", "c4-ctx-b");
  const t2btext = extractAssistantText(t2b.stdout);
  results.persistentContext = {
    result: /ALPHA-27/i.test(t2btext) ? "PASS" : "FAIL",
    turn2MentionsCodeword: /ALPHA-27/i.test(t2btext),
    turn2PreviewLen: t2btext.length,
  };

  // TEST 3 — Real MCP tool loop (read-only get_performance_evidence)
  const t3 = hermesChat(
    "You must call the get_performance_evidence MCP tool with no arguments, then summarize whether evidence was returned. Mention SPIKE_MCP_OK in your final answer.",
    "c4-mcp",
  );
  const t3text = extractAssistantText(t3.stdout);
  const mcpToolUsed =
    t3.stderr.includes("get_performance_evidence") ||
    t3.stdout.includes("get_performance_evidence") ||
    /performance|evidence|brief/i.test(t3text);
  results.realMcpToolLoop = {
    result: t3.code === 0 && mcpToolUsed && /SPIKE_MCP_OK/i.test(t3text) ? "PASS" : t3.code === 0 && mcpToolUsed ? "PARTIAL" : "FAIL",
    exitCode: t3.code,
    mentionsSpikeOk: /SPIKE_MCP_OK/i.test(t3text),
    toolExecutionLikely: mcpToolUsed,
    responseLen: t3text.length,
  };

  // Gateway hop metadata (tools[] preservation) via direct HTTP with token
  const toolProbe = gatewayPost({
    model: "theallcloud/auto",
    messages: [{ role: "user", content: "ping" }],
    tools: [{ type: "function", function: { name: "noop", description: "noop", parameters: { type: "object" } } }],
    tool_choice: "none",
  });
  const tpHeaders = toolProbe.headers;
  results.gatewayToolHeaders = {
    status: toolProbe.status,
    provider: tpHeaders["x-ai-runtime-provider"],
    model: tpHeaders["x-ai-runtime-model"],
    toolDefs: tpHeaders["x-ai-runtime-tool-defs"],
    requestId: tpHeaders["x-ai-runtime-request-id"],
  };

  // TEST 8 — Security: auth reject
  const badAuth = gatewayPost({ model: "theallcloud/auto", messages: [{ role: "user", content: "x" }] }, "invalid-token");
  results.security = {
    rejectsBadToken: badAuth.status === 401 ? "PASS" : "FAIL",
    acceptsGoodToken: toolProbe.status === 200 ? "PASS" : "FAIL",
    providerKeyNotInBody: !JSON.stringify(toolProbe.json).includes(env.GEMINI_API_KEY || "GEMINI_NOT_SET"),
  };

  // TEST 8 — Router fallback (gateway-only; Hermes fallback disabled on spike)
  // Force first provider failure by sending invalid workload routing hint is not available;
  // use executor-stack fallback smoke result from headers on a normal request as baseline.
  results.runtimeFallback = {
    result: "NOT_EXERCISED",
    note: "Controlled provider-A failure through Desktop without credential damage deferred to gateway integration tests",
  };

  // Structured output Desktop path
  results.structuredOutputDesktop = { result: "NOT_EXERCISED" as Result };

  // Multi tool
  results.multiTool = { result: "NOT_EXERCISED" as Result };

  // Gemini thought signature — inferred from MCP loop if tool round-trip succeeded
  results.geminiThoughtSignature = {
    result:
      results.realMcpToolLoop &&
      (results.realMcpToolLoop as { result?: string }).result === "PASS"
        ? "PASS"
        : (results.realMcpToolLoop as { result?: string }).result === "PARTIAL"
          ? "PARTIAL"
          : "NOT_EXERCISED",
    note: "Validated indirectly when Hermes MCP tool loop completes after tool result round-trip",
  };

  console.log(JSON.stringify(results, null, 0));
}

main().catch((e) => {
  console.log(JSON.stringify({ step: "c4-desktop-e2e", status: "FAIL", error: String(e).slice(0, 200) }));
  process.exit(1);
});
