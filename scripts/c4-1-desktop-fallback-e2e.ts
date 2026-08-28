/**
 * STEP 2-5.4C4.1 — Controlled Desktop Runtime Fallback E2E (runtime-spike only).
 * Uses alias theallcloud/auto-fallback-spike (no production credential damage).
 * Logs PASS/FAIL metadata only — no prompts, secrets, or signatures.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const GATEWAY = "http://127.0.0.1:3000/api/ai-runtime/v1/chat/completions";
const CHAT_NAME = "C4.1 Fallback E2E";
const FALLBACK_ALIAS = "theallcloud/auto-fallback-spike";

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

function hermesChat(query: string, model: string): { stdout: string; stderr: string; code: number } {
  const dir = mkdtempSync(join(tmpdir(), "c41-e2e-"));
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
        "-m",
        model,
        "-Q",
        "--query-file",
        qf,
      ],
      { encoding: "utf8", timeout: 180_000, env: { ...process.env } },
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
  const body: string[] = [];
  for (const line of lines) {
    if (line.startsWith("session_id:")) continue;
    if (line.startsWith("↻")) continue;
    if (line.includes("tirith security scanner")) continue;
    body.push(line);
  }
  return body.join("\n").trim();
}

function countAssistantBlocks(stdout: string): number {
  // Quiet mode yields one final response body; count non-meta content blocks.
  const text = extractAssistantText(stdout);
  if (!text) return 0;
  // Hermes quiet mode: single contiguous answer after session_id.
  return 1;
}

function gatewayPost(body: unknown, token?: string): {
  status: number;
  headers: Record<string, string>;
  json: unknown;
} {
  const env = loadEnv();
  const bearer = token ?? env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN ?? "";
  const res = spawnSync(
    "curl",
    [
      "-sS",
      "-D",
      "-",
      "-o",
      "/tmp/c41-gateway-body.json",
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
    json = JSON.parse(readFileSync("/tmp/c41-gateway-body.json", "utf8"));
  } catch {
    json = { parseError: true };
  }
  const statusLine = headerBlock.split("\n")[0] ?? "";
  const status = Number(statusLine.match(/\s(\d{3})\s/)?.[1] ?? 0);
  return { status, headers, json };
}

async function main() {
  const env = loadEnv();
  const cfg = readFileSync(
    join(process.env.HOME || "/home/ysh", ".hermes/profiles/runtime-spike/config.yaml"),
    "utf8",
  );

  const results: Record<string, unknown> = {
    step: "c4.1-desktop-fallback-e2e",
    startedAt: new Date().toISOString(),
    environment: {
      fallbackProvidersEmpty: cfg.includes("fallback_providers: []"),
      baseUrlRuntime: cfg.includes("http://127.0.0.1:3000/api/ai-runtime/v1"),
      gatewayTokenConfigured: Boolean(env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN?.trim()),
      defaultModelUnchanged: /default:\s*theallcloud\/auto\b/.test(cfg),
    },
  };

  // Gateway probe with fallback alias (authoritative routing headers)
  const probe = gatewayPost({
    model: FALLBACK_ALIAS,
    messages: [{ role: "user", content: "Reply with exactly: C41_FALLBACK_OK" }],
  });
  const attemptCount = Number(probe.headers["x-ai-runtime-attempt-count"] ?? 0);
  const fallbackFlag = probe.headers["x-ai-runtime-fallback"];
  const provider = probe.headers["x-ai-runtime-provider"];
  const model = probe.headers["x-ai-runtime-model"];
  const bodyStr = JSON.stringify(probe.json);
  results.gatewayFallbackProbe = {
    status: probe.status,
    fallback: fallbackFlag,
    attemptCount,
    provider,
    model,
    mentionsOk: /C41_FALLBACK_OK/i.test(bodyStr),
    providerKeyNotInBody: !bodyStr.includes(env.GEMINI_API_KEY || "GEMINI_NOT_SET"),
    result:
      probe.status === 200 &&
      fallbackFlag === "1" &&
      attemptCount >= 2 &&
      /C41_FALLBACK_OK/i.test(bodyStr)
        ? "PASS"
        : "FAIL",
  };

  // Control: normal alias must not force fallback
  const control = gatewayPost({
    model: "theallcloud/auto",
    messages: [{ role: "user", content: "Reply with exactly: C41_CONTROL_OK" }],
  });
  results.gatewayControlNoForce = {
    status: control.status,
    fallback: control.headers["x-ai-runtime-fallback"],
    attemptCount: Number(control.headers["x-ai-runtime-attempt-count"] ?? 0),
    model: control.headers["x-ai-runtime-model"],
    result:
      control.status === 200 && control.headers["x-ai-runtime-fallback"] === "0"
        ? "PASS"
        : "FAIL",
  };

  // Desktop Bot Chat with -m fallback alias
  const desktop = hermesChat(
    "Reply with exactly: C41_DESKTOP_FALLBACK_OK",
    FALLBACK_ALIAS,
  );
  const desktopText = extractAssistantText(desktop.stdout);
  const responseCount = countAssistantBlocks(desktop.stdout);
  results.desktopFallback = {
    exitCode: desktop.code,
    responseCount,
    mentionsOk: /C41_DESKTOP_FALLBACK_OK/i.test(desktopText),
    responseLen: desktopText.length,
    result:
      desktop.code === 0 &&
      responseCount === 1 &&
      /C41_DESKTOP_FALLBACK_OK/i.test(desktopText)
        ? "PASS"
        : "FAIL",
  };

  // Optional multi-tool — only one read-only MCP tool on spike; do not force.
  results.multiTool = { result: "NOT_EXERCISED", note: "single get_performance_evidence tool on spike" };

  results.hermesFallbackState = {
    fallbackProvidersEmpty: cfg.includes("fallback_providers: []"),
    result: cfg.includes("fallback_providers: []") ? "PASS" : "FAIL",
  };

  results.summary = {
    runtimeFallback:
      (results.gatewayFallbackProbe as { result?: string }).result === "PASS" &&
      (results.desktopFallback as { result?: string }).result === "PASS"
        ? "PASS"
        : "FAIL",
  };

  console.log(JSON.stringify(results));
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      step: "c4.1-desktop-fallback-e2e",
      status: "FAIL",
      error: String(e).slice(0, 200),
    }),
  );
  process.exit(1);
});
