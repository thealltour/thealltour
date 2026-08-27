/**
 * One-off ops validation helpers (STEP 2-5.4B-OPS).
 * Does not replace cron-daily-marketing-plan.ts — preflight + adapter smoke only.
 */
import { loadLocalEnv } from "./loadLocalEnv";
import type { ModelDefinition } from "../src/ai-runtime/domain/model";
import { buildRuntimeStatus } from "../src/ai-runtime/observability/runtime-status";
import { createDefaultAiRuntimeRegistry } from "../src/ai-runtime/registry/registry";
import { AI_MODEL_IDS, AI_PROVIDER_IDS } from "../src/ai-runtime/registry";
import {
  createEnvCredentialResolver,
  createGeminiAdapter,
  createNvidiaAdapter,
  createOpenRouterAdapter,
} from "../src/ai-runtime/adapters";
import { createHeuristicTokenEstimator } from "../src/ai-runtime/tokens";
import { checkContextFit } from "../src/ai-runtime/tokens/heuristic-estimator";
import { createCronRuntimeRequest } from "../src/ai-runtime/integration";
import { buildContentDraftPrompt } from "../src/lib/marketing/cron/marketingPlanSpecialists";
import { PUBLICATION_FLOW_INACTIVE } from "../src/lib/marketing/social/publication/governanceBoundary";

loadLocalEnv();

const SMOKE_USER = "Respond with exactly: OK";

function safeLog(label: string, value: unknown): void {
  console.log(`${label}: ${JSON.stringify(value)}`);
}

async function adapterSmoke(
  label: string,
  providerId: string,
  modelId: string,
  adapter: ReturnType<typeof createGeminiAdapter>,
  model: ModelDefinition,
): Promise<void> {
  const request = createCronRuntimeRequest(
    {
      agentId: "content-strategist",
      workload: "content_draft",
      messages: [{ role: "user", content: SMOKE_USER }],
      correlationId: "ops-preflight-smoke",
      cronJobId: "ops-preflight",
    },
    { createRequestId: () => `ops-smoke-${providerId}` },
  );

  try {
    const started = Date.now();
    const response = await adapter.generate(request, model, {
      credentialResolver: createEnvCredentialResolver(),
    });
    const latencyMs = Date.now() - started;
    const contentPreview = response.content.slice(0, 40).replace(/\s+/g, " ");
    safeLog(`${label}_RESULT`, {
      success: true,
      http: "ok",
      modelSlug: model.modelId,
      latencyMs,
      usagePresent: Boolean(
        response.usage?.inputTokens != null || response.usage?.totalTokens != null,
      ),
      usageMissing: response.rawMetadata?.usageMissing === true,
      rateLimitPresent: Boolean(response.rawMetadata?.rateLimit || response.rawMetadata?.retryAfterMs),
      contentPreview,
      providerId: response.providerId,
      registryModelId: response.modelId,
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as { code?: string }).code : "UNKNOWN";
    safeLog(`${label}_RESULT`, {
      success: false,
      runtimeError: code,
      message: error instanceof Error ? error.message.slice(0, 200) : String(error),
    });
  }
}

async function main(): Promise<void> {
  console.log("=== OPS PREFLIGHT ===");
  safeLog("PUBLICATION_FLOW_INACTIVE", PUBLICATION_FLOW_INACTIVE);
  safeLog("FEATURE_FLAG", process.env.AI_RUNTIME_MARKETING_CRON_ENABLED ?? "<unset>");

  const status = buildRuntimeStatus({ env: process.env, now: () => new Date() });
  for (const provider of status.providers) {
    console.log(
      `PROVIDER ${provider.id} enabled=${provider.enabled} credential=${provider.credentialConfigured} adapter=${provider.adapterReadiness}`,
    );
  }

  const registry = createDefaultAiRuntimeRegistry();
  for (const model of registry.listModels()) {
    console.log(`MODEL ${model.id} provider=${model.providerId} slug=${model.modelId}`);
  }

  const gemini = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
  const openrouter = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE)!;
  const nvidia = registry.getModelById(AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA)!;

  console.log("=== ADAPTER SMOKE ===");
  await adapterSmoke("GEMINI", AI_PROVIDER_IDS.GEMINI_MAIN, gemini.id, createGeminiAdapter(), gemini);
  await adapterSmoke(
    "OPENROUTER",
    AI_PROVIDER_IDS.OPENROUTER_MAIN,
    openrouter.id,
    createOpenRouterAdapter(),
    openrouter,
  );
  await adapterSmoke("NVIDIA", AI_PROVIDER_IDS.NVIDIA_MAIN, nvidia.id, createNvidiaAdapter(), nvidia);

  console.log("=== TOKEN ESTIMATE (content_draft sample) ===");
  const samplePayload = {
    productId: "98a889e9-fbc4-41e3-8302-0d2b042fbe0a",
    channel: "threads",
    goal: "sample",
    agenda: null,
    brief: null,
    constraints: ["no invent"],
    memoryReferences: [] as string[],
  };
  const sampleRequest = createCronRuntimeRequest({
    agentId: "content-strategist",
    workload: "content_draft",
    messages: [{ role: "user", content: buildContentDraftPrompt(samplePayload) }],
    correlationId: "ops-token-estimate",
    cronJobId: "daily-marketing-plan",
  });
  const estimator = createHeuristicTokenEstimator();
  const estimate = estimator.estimate(sampleRequest, gemini);
  const contextFit = checkContextFit(estimate, gemini);
  safeLog("TOKEN_ESTIMATE", {
    workload: sampleRequest.workload,
    rawEstimatedInputTokens: estimate.rawEstimatedInputTokens,
    adjustedEstimatedInputTokens: estimate.estimatedInputTokens,
    estimatedOutputTokens: estimate.estimatedOutputTokens,
    estimatedTotalTokens: estimate.estimatedTotalTokens,
    safetyMultiplier: estimate.safetyMultiplier,
    fitsContext: contextFit.fitsContext,
    contextLimit: gemini.limits.contextTokens ?? "unknown",
  });
}

main().catch((error: unknown) => {
  console.error("ops preflight failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
