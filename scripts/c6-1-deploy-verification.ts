/**
 * STEP 2-5.4C6.1 — one-shot deploy verification (auth, negative, observability).
 * Logs metadata only — no secrets, prompts, or raw provider payloads.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import {
  HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
} from "../src/ai-runtime/gateway/alias-registry";
import { HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE } from "../src/ai-runtime/integration/constants";

const GATEWAY = "http://127.0.0.1:3000/api/ai-runtime/v1/chat/completions";

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

function gatewayPost(opts: {
  alias: string;
  token?: string;
  forwardedFor?: string;
  metadata?: Record<string, unknown>;
}): { status: number; headers: Record<string, string>; body: string } {
  const payload: Record<string, unknown> = {
    model: opts.alias,
    messages: [{ role: "user", content: "Reply with exactly: C6_1_VERIFY" }],
  };
  if (opts.metadata) payload.metadata = opts.metadata;

  const args = [
    "-sS",
    "-D",
    "-",
    "-o",
    "/tmp/c6-1-body.json",
    "-X",
    "POST",
    GATEWAY,
    "-H",
    "Content-Type: application/json",
  ];
  if (opts.token) args.push("-H", `Authorization: Bearer ${opts.token}`);
  if (opts.forwardedFor) args.push("-H", `X-Forwarded-For: ${opts.forwardedFor}`);
  args.push("-d", JSON.stringify(payload));

  const res = spawnSync("curl", args, { encoding: "utf8", timeout: 120_000 });
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
    body = readFileSync("/tmp/c6-1-body.json", "utf8");
  } catch {
    body = "";
  }
  const statusLine = headerBlock.split("\n")[0] ?? "";
  const status = Number(statusLine.match(/\s(\d{3})\s/)?.[1] ?? 0);
  return { status, headers, body };
}

function bodyHasSecretLeak(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    /sk-[a-z0-9]{10,}/i.test(body) ||
    /api[_-]?key/i.test(lower) ||
    /bearer\s+[a-z0-9._-]{20,}/i.test(body) ||
    /authorization/i.test(lower)
  );
}

async function queryObservability(sinceIso: string) {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, reason: "supabase credentials not configured for query" };
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("ai_runtime_observability_events")
    .select(
      "occurred_at,event_type,agent_id,source,workload,provider_id,model_id,fallback_used,attempt_count,latency_ms,input_tokens,output_tokens,correlation_id,request_id",
    )
    .gte("occurred_at", sinceIso)
    .in("agent_id", [
      "performance-analyst",
      "content-strategist",
      "governance-auditor",
      "marketing-manager",
    ])
    .order("occurred_at", { ascending: false })
    .limit(20);

  if (error) return { ok: false, reason: error.message };
  const rows = (data ?? []).map((row) => ({
    occurredAt: row.occurred_at,
    eventType: row.event_type,
    agentId: row.agent_id,
    workload: row.workload,
    provider: row.provider_id,
    model: row.model_id,
    fallbackUsed: row.fallback_used,
    attemptCount: row.attempt_count,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    correlationId: row.correlation_id ? String(row.correlation_id).slice(0, 40) : undefined,
    requestId: row.request_id,
  }));
  const spikeRows = rows.filter((r) => r.agentId === "runtime-spike");
  return {
    ok: true,
    rowCount: rows.length,
    productionAgentRows: rows.length - spikeRows.length,
    spikeAttributionRows: spikeRows.length,
    rows: rows.slice(0, 8),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const env = loadEnv();
  const token = env.AI_RUNTIME_INFERENCE_GATEWAY_TOKEN ?? "";

  const auth = {
    unauthenticated: gatewayPost({ alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST }),
    invalidBearer: gatewayPost({
      alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
      token: "invalid-token-for-c6-1",
    }),
    publicNetworkBlocked: gatewayPost({
      alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
      token,
      forwardedFor: "8.8.8.8",
    }),
    validBearer: gatewayPost({
      alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
      token,
    }),
  };

  const negative = {
    unknownAlias: gatewayPost({ alias: "openai/gpt-4o", token }),
    productionWithSpikeMetadata: gatewayPost({
      alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
      token,
      metadata: { spikeForceFallback: true },
    }),
    spikeFallbackAlias: gatewayPost({
      alias: HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
      token,
      metadata: { spikeForceFallback: true },
    }),
  };

  const observability = await queryObservability(new Date(Date.now() - 15 * 60_000).toISOString());

  const report = {
    step: "c6-1-deploy-verification",
    startedAt,
    auth: {
      unauthenticatedStatus: auth.unauthenticated.status,
      unauthenticatedPass: auth.unauthenticated.status === 401,
      invalidBearerStatus: auth.invalidBearer.status,
      invalidBearerPass: auth.invalidBearer.status === 401,
      publicNetworkStatus: auth.publicNetworkBlocked.status,
      publicNetworkPass: auth.publicNetworkBlocked.status === 403,
      validBearerStatus: auth.validBearer.status,
      validBearerPass: auth.validBearer.status === 200,
      validBearerAgentId: auth.validBearer.headers["x-ai-runtime-agent-id"],
      validBearerWorkload: auth.validBearer.headers["x-ai-runtime-workload"],
      secretLeakInValidResponse: bodyHasSecretLeak(auth.validBearer.body),
    },
    negative: {
      unknownAlias: {
        status: negative.unknownAlias.status,
        pass: negative.unknownAlias.status === 400 || negative.unknownAlias.status === 422,
        code: (() => {
          try {
            return JSON.parse(negative.unknownAlias.body)?.error?.code;
          } catch {
            return undefined;
          }
        })(),
      },
      productionWithSpikeMetadata: {
        status: negative.productionWithSpikeMetadata.status,
        agentId: negative.productionWithSpikeMetadata.headers["x-ai-runtime-agent-id"],
        fallbackHeader: negative.productionWithSpikeMetadata.headers["x-ai-runtime-fallback"],
        pass:
          negative.productionWithSpikeMetadata.status === 200 &&
          negative.productionWithSpikeMetadata.headers["x-ai-runtime-agent-id"] ===
            "performance-analyst" &&
          negative.productionWithSpikeMetadata.headers["x-ai-runtime-fallback"] !== "1",
      },
      spikeFallbackAlias: {
        status: negative.spikeFallbackAlias.status,
        agentId: negative.spikeFallbackAlias.headers["x-ai-runtime-agent-id"],
        fallbackHeader: negative.spikeFallbackAlias.headers["x-ai-runtime-fallback"],
        attemptCount: negative.spikeFallbackAlias.headers["x-ai-runtime-attempt-count"],
        pass:
          negative.spikeFallbackAlias.status === 200 &&
          negative.spikeFallbackAlias.headers["x-ai-runtime-agent-id"] === "runtime-spike" &&
          negative.spikeFallbackAlias.headers["x-ai-runtime-fallback"] === "1",
      },
    },
    observability,
    summary: {
      authPass:
        auth.unauthenticated.status === 401 &&
        auth.invalidBearer.status === 401 &&
        auth.publicNetworkBlocked.status === 403 &&
        auth.validBearer.status === 200 &&
        !bodyHasSecretLeak(auth.validBearer.body),
      negativePass: false as boolean,
      observabilityPass: false as boolean,
    },
  };

  report.summary.negativePass =
    report.negative.unknownAlias.pass &&
    report.negative.productionWithSpikeMetadata.pass &&
    report.negative.spikeFallbackAlias.pass;
  report.summary.observabilityPass =
    observability.ok === true &&
    (observability.spikeAttributionRows ?? 0) === 0 &&
    (observability.productionAgentRows ?? 0) >= 4;

  console.log(JSON.stringify(report, null, 2));
  const allPass =
    report.summary.authPass && report.summary.negativePass && report.summary.observabilityPass;
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.log(JSON.stringify({ step: "c6-1-deploy-verification", status: "FAIL", error: String(error) }));
  process.exit(1);
});
