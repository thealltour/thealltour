/**
 * Safe smoke: Gemini/NVIDIA tool protocol (no raw secrets / full payloads logged).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createEnvCredentialResolver } from "@/ai-runtime/adapters/env-credential-resolver";
import { createGeminiAdapter } from "@/ai-runtime/adapters/gemini/adapter";
import { createNvidiaAdapter } from "@/ai-runtime/adapters/nvidia/adapter";
import { DEFAULT_AI_MODELS, AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import {
  mapRuntimeMessagesToGemini,
  mapRuntimeToolsToGemini,
  mapRuntimeToolChoiceToGemini,
} from "@/ai-runtime/adapters/gemini/mapper";

function loadEnvLocal(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  const files = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME || "/home/ysh", ".hermes/.env"),
  ];
  for (const file of files) {
  try {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in env) || !env[key]) env[key] = value;
    }
  } catch {
    // ignore missing file
  }
  }
  return env;
}

async function smokeOne(
  label: string,
  adapter: { generate: Function },
  modelId: string,
  env: Record<string, string | undefined>,
) {
  const model = DEFAULT_AI_MODELS.find((m) => m.id === modelId);
  if (!model) {
    console.log(JSON.stringify({ label, status: "UNSUPPORTED", reason: "model_missing" }));
    return;
  }
  const request = createRuntimeRequest({
    agentId: "runtime-spike",
    source: "system",
    workload: "manager_decision",
    priority: "high",
    messages: [{ role: "user", content: "Call echo_codeword with codeword SPIKE_TOOL_OK now." }],
    tools: [
      {
        type: "function",
        function: {
          name: "echo_codeword",
          description: "Return the given codeword unchanged.",
          parameters: {
            type: "object",
            properties: { codeword: { type: "string" } },
            required: ["codeword"],
          },
        },
      },
    ],
    toolChoice: "required",
    routing: { requiresToolCalling: true },
  });

  if (label === "gemini-shape") {
    const body = mapRuntimeMessagesToGemini(request.messages);
    const tools = mapRuntimeToolsToGemini(request.tools);
    const toolConfig = mapRuntimeToolChoiceToGemini(request.toolChoice);
    const params = tools?.[0]?.functionDeclarations?.[0]?.parameters as { type?: string } | undefined;
    console.log(
      JSON.stringify({
        label,
        status: "PASS",
        hasTools: Boolean(tools?.length),
        schemaType: params?.type,
        toolMode: toolConfig?.functionCallingConfig.mode,
        contentCount: body.contents.length,
      }),
    );
    return;
  }

  try {
    const result = await adapter.generate(request, model, {
      credentialResolver: createEnvCredentialResolver({ env }),
    });
    console.log(
      JSON.stringify({
        label,
        status: result.toolCalls?.length ? "PASS" : "FAIL",
        providerId: result.providerId,
        finishReason: result.finishReason,
        toolCallCount: result.toolCalls?.length ?? 0,
        hasContent: Boolean(result.content?.trim()),
        firstToolName: result.toolCalls?.[0]?.function.name,
        partKeys: result.rawMetadata?.geminiPartKeys,
        finishRaw: result.rawMetadata?.geminiFinishReason,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    console.log(JSON.stringify({ label, status: "FAIL", error: message }));
  }
}

async function main() {
  const env = loadEnvLocal();
  await smokeOne("gemini-shape", createGeminiAdapter(), AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY, env);
  await smokeOne("gemini-live", createGeminiAdapter(), AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY, env);
  await smokeOne("nvidia-live", createNvidiaAdapter(), AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA, env);
}

main();
