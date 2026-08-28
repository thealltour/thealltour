/**
 * STEP 2-5.4C6 — Gateway smoke for production aliases (no Hermes profile changes).
 *
 * Default: HTTP curl against :3000 (requires redeployed Next.js with C6 headers).
 * --local: in-process RuntimeExecutor (validates mapping without service restart).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { handleOpenAiCompatChatCompletion } from "../src/ai-runtime/gateway";
import { createRuntimeExecutorStack } from "../src/ai-runtime/integration/runtime-stack";
import { DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS } from "../src/ai-runtime/integration/constants";
import {
  HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
  HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
  HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
  HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
} from "../src/ai-runtime/gateway/alias-registry";

const GATEWAY = "http://127.0.0.1:3000/api/ai-runtime/v1/chat/completions";

const ALIASES = [
  {
    alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
    agentId: "performance-analyst",
    workload: "analysis",
  },
  {
    alias: HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
    agentId: "content-strategist",
    workload: "content_draft",
  },
  {
    alias: HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
    agentId: "governance-auditor",
    workload: "governance",
  },
  {
    alias: HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
    agentId: "marketing-manager",
    workload: "manager_decision",
  },
] as const;

type SmokeResult = {
  step: string;
  mode: string;
  startedAt: string;
  aliases: Record<string, unknown>;
  summary: { result: "PASS" | "FAIL" };
  gatewayTokenConfigured?: boolean;
};

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

function gatewayPost(
  alias: string,
  token: string,
): { status: number; headers: Record<string, string>; body: string } {
  const res = spawnSync(
    "curl",
    [
      "-sS",
      "-D",
      "-",
      "-o",
      "/tmp/c6-gateway-body.json",
      "-X",
      "POST",
      GATEWAY,
      "-H",
      "Content-Type: application/json",
      "-H",
      `Authorization: Bearer ${token}`,
      "-d",
      JSON.stringify({
        model: alias,
        messages: [{ role: "user", content: "Reply with exactly: C6_ALIAS_OK" }],
      }),
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
  let body = "";
  try {
    body = readFileSync("/tmp/c6-gateway-body.json", "utf8");
  } catch {
    body = "";
  }
  const statusLine = headerBlock.split("\n")[0] ?? "";
  const status = Number(statusLine.match(/\s(\d{3})\s/)?.[1] ?? 0);
  return { status, headers, body };
}

async function runLocalSmoke(): Promise<SmokeResult> {
  const env = loadEnv();
  const executor = createRuntimeExecutorStack({ env });
  const aliasResults: Record<string, unknown> = {};
  let allPass = true;

  for (const spec of ALIASES) {
    const result = await handleOpenAiCompatChatCompletion({
      executor,
      body: {
        model: spec.alias,
        messages: [{ role: "user", content: "Reply with exactly: C6_ALIAS_OK" }],
      },
      timeoutMs: DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS,
    });
    const content = result.ok ? (result.json?.choices[0]?.message?.content ?? "") : "";
    const pass =
      result.ok &&
      result.routing.agentId === spec.agentId &&
      result.routing.workload === spec.workload &&
      /C6_ALIAS_OK/i.test(content);
    if (!pass) allPass = false;
    aliasResults[spec.alias] = {
      ok: result.ok,
      agentId: result.ok ? result.routing.agentId : undefined,
      workload: result.ok ? result.routing.workload : undefined,
      provider: result.ok ? result.routing.providerId : undefined,
      model: result.ok ? result.routing.modelId : undefined,
      mentionsOk: /C6_ALIAS_OK/i.test(content),
      notSpikeAttribution: result.ok ? result.routing.agentId !== "runtime-spike" : false,
      result: pass ? "PASS" : "FAIL",
    };
  }

  return {
    step: "c6-production-alias-gateway-smoke",
    mode: "local-executor",
    startedAt: new Date().toISOString(),
    aliases: aliasResults,
    summary: { result: allPass ? "PASS" : "FAIL" },
  };
}

function runHttpSmoke(token: string): SmokeResult {
  const aliasResults: Record<string, unknown> = {};
  let allPass = true;

  for (const spec of ALIASES) {
    const probe = gatewayPost(spec.alias, token);
    const agentHeader = probe.headers["x-ai-runtime-agent-id"] ?? "";
    const workloadHeader = probe.headers["x-ai-runtime-workload"] ?? "";
    const provider = probe.headers["x-ai-runtime-provider"] ?? "";
    const model = probe.headers["x-ai-runtime-model"] ?? "";
    const pass =
      probe.status === 200 &&
      agentHeader === spec.agentId &&
      workloadHeader === spec.workload &&
      /C6_ALIAS_OK/i.test(probe.body);
    if (!pass) allPass = false;
    aliasResults[spec.alias] = {
      status: probe.status,
      agentId: agentHeader,
      workload: workloadHeader,
      provider,
      model,
      mentionsOk: /C6_ALIAS_OK/i.test(probe.body),
      notSpikeAttribution: agentHeader !== "runtime-spike",
      result: pass ? "PASS" : "FAIL",
    };
  }

  return {
    step: "c6-production-alias-gateway-smoke",
    mode: "http-curl",
    startedAt: new Date().toISOString(),
    gatewayTokenConfigured: Boolean(token.trim()),
    aliases: aliasResults,
    summary: { result: allPass ? "PASS" : "FAIL" },
  };
}

async function main() {
  const useLocal = process.argv.includes("--local");
  if (useLocal) {
    const out = await runLocalSmoke();
    console.log(JSON.stringify(out));
    process.exit(out.summary.result === "PASS" ? 0 : 1);
    return;
  }

  const env = loadEnv();
  const token = env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN ?? "";
  if (!token.trim()) {
    console.log(
      JSON.stringify({
        step: "c6-production-alias-gateway-smoke",
        mode: "http-curl",
        error: "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN missing",
      }),
    );
    process.exit(1);
  }

  const out = runHttpSmoke(token);
  console.log(JSON.stringify(out));
  process.exit(out.summary.result === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.log(
    JSON.stringify({
      step: "c6-production-alias-gateway-smoke",
      status: "FAIL",
      error: String(error).slice(0, 200),
    }),
  );
  process.exit(1);
});
