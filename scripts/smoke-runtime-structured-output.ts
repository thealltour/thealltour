/**
 * Structured-output live smoke (no secrets / full schema dump).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createEnvCredentialResolver } from "@/ai-runtime/adapters/env-credential-resolver";
import { createGeminiAdapter } from "@/ai-runtime/adapters/gemini/adapter";
import { createNvidiaAdapter } from "@/ai-runtime/adapters/nvidia/adapter";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import { mapOpenAiCompatToRuntimeRequest } from "@/ai-runtime/gateway";
import { AI_MODEL_IDS, DEFAULT_AI_MODELS } from "@/ai-runtime/registry/models";
import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";
import { RuntimeError } from "@/ai-runtime/domain/error";

function loadEnv() {
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
    } catch {}
  }
  return env;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const env = loadEnv();
  const executor = createRuntimeExecutorStack({ env });
  const schema = {
    type: "object",
    properties: {
      status: { type: "string" },
      count: { type: "integer" },
    },
    required: ["status", "count"],
  };

  // TEST 1 json_object via gateway mapping + executor
  const t1 = mapOpenAiCompatToRuntimeRequest({
    model: HERMES_INFERENCE_ALIAS_AUTO,
    messages: [
      {
        role: "user",
        content: 'Reply with a JSON object: {"ok":true,"label":"SPIKE_JSON_OBJECT"}',
      },
    ],
    response_format: { type: "json_object" },
  });
  const r1 = await executor.executeAndWait(t1.request, { timeoutMs: 120_000 });
  const c1 = r1.response?.content ?? "";
  const p1 = tryParseJson(c1);
  console.log(
    JSON.stringify({
      test: "json_object",
      status: r1.status,
      providerId: r1.response?.providerId,
      modelId: r1.response?.modelId,
      requiresStructuredOutput: t1.request.routing?.requiresStructuredOutput === true,
      responseFormatType: t1.request.responseFormat?.type,
      validJson: Boolean(p1 && typeof p1 === "object"),
      result: r1.status === "completed" && p1 && typeof p1 === "object" ? "PASS" : "FAIL",
    }),
  );

  // TEST 2 json_schema
  const t2 = mapOpenAiCompatToRuntimeRequest({
    model: HERMES_INFERENCE_ALIAS_AUTO,
    messages: [
      {
        role: "user",
        content: "Return status=ok and count=2 as structured JSON matching the schema.",
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "spike_status", schema, strict: true },
    },
  });
  const r2 = await executor.executeAndWait(t2.request, { timeoutMs: 120_000 });
  const c2 = r2.response?.content ?? "";
  const p2 = tryParseJson(c2) as { status?: unknown; count?: unknown } | null;
  const schemaOk =
    !!p2 &&
    typeof p2 === "object" &&
    typeof p2.status === "string" &&
    typeof p2.count === "number" &&
    Number.isInteger(p2.count);
  console.log(
    JSON.stringify({
      test: "json_schema",
      status: r2.status,
      errorCode: r2.error?.code,
      providerId: r2.response?.providerId,
      modelId: r2.response?.modelId,
      schemaOk,
      contentLen: c2.length,
      result: r2.status === "completed" && schemaOk ? "PASS" : "FAIL",
    }),
  );

  // TEST 3 tools + structured (Gemini must reject)
  const gemini = createGeminiAdapter();
  const geminiModel = DEFAULT_AI_MODELS.find((m) => m.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
  const combo = createRuntimeRequest({
    agentId: "runtime-spike",
    source: "system",
    workload: "manager_decision",
    priority: "high",
    messages: [{ role: "user", content: "call a tool then json" }],
    tools: [{ type: "function", function: { name: "noop", parameters: { type: "object" } } }],
    responseFormat: { type: "json_object" },
    routing: { requiresToolCalling: true, requiresStructuredOutput: true },
  });
  let comboResult = "FAIL";
  try {
    await gemini.generate(combo, geminiModel, {
      credentialResolver: createEnvCredentialResolver({ env }),
    });
  } catch (error) {
    if (error instanceof RuntimeError && error.code === "INVALID_REQUEST") {
      comboResult = "UNSUPPORTED";
    }
  }
  console.log(JSON.stringify({ test: "tools_plus_schema_gemini", result: comboResult }));

  // NVIDIA structured smoke (direct)
  const nvidia = createNvidiaAdapter();
  const nvidiaModel = DEFAULT_AI_MODELS.find((m) => m.id === AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA)!;
  try {
    const nr = await nvidia.generate(
      createRuntimeRequest({
        agentId: "runtime-spike",
        source: "system",
        workload: "content_draft",
        priority: "high",
        messages: [
          {
            role: "user",
            content: 'Respond with JSON object {"status":"ok","count":1} only.',
          },
        ],
        responseFormat: {
          type: "json_schema",
          name: "spike_status",
          schema,
          strict: true,
        },
        routing: { requiresStructuredOutput: true },
      }),
      nvidiaModel,
      { credentialResolver: createEnvCredentialResolver({ env }) },
    );
    const np = tryParseJson(nr.content ?? "");
    const nvidiaOk =
      !!np &&
      typeof np === "object" &&
      typeof (np as { status?: unknown }).status === "string" &&
      typeof (np as { count?: unknown }).count === "number";
    console.log(
      JSON.stringify({
        test: "nvidia_json_schema",
        finishReason: nr.finishReason,
        validSchemaish: nvidiaOk,
        result: nvidiaOk ? "PASS" : "FAIL",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    console.log(JSON.stringify({ test: "nvidia_json_schema", result: "FAIL", error: message }));
  }
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "FAIL", error: String(error).slice(0, 200) }));
  process.exit(1);
});
