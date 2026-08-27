import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { AI_PROVIDER_IDS, DEFAULT_AI_PROVIDERS } from "@/ai-runtime/registry/providers";
import {
  assertAdapterOwnsModel,
  assertHasMessages,
  buildSuccessResponse,
  parseJsonBody,
  providerFetchJson,
  resolveApiKey,
  resolveTimeoutMs,
  usageFromPartial,
} from "@/ai-runtime/adapters/base";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import {
  extractGeminiText,
  extractGeminiToolCalls,
  extractGeminiUsage,
  mapGeminiFinishReason,
  mapRuntimeMessagesToGemini,
  mapRuntimeToolChoiceToGemini,
  mapRuntimeToolsToGemini,
  mapRuntimeResponseFormatToGemini,
} from "@/ai-runtime/adapters/gemini/mapper";
import { RuntimeError } from "@/ai-runtime/domain/error";

const GEMINI_BASE =
  process.env.GEMINI_API_BASE_URL?.trim() ||
  "https://generativelanguage.googleapis.com/v1beta";

function geminiCredentialRef(): string {
  const provider = DEFAULT_AI_PROVIDERS.find((row) => row.id === AI_PROVIDER_IDS.GEMINI_MAIN);
  return provider?.credentialRef ?? "ai-provider/gemini/main";
}

export class GeminiAdapter implements ProviderAdapter {
  readonly providerId = AI_PROVIDER_IDS.GEMINI_MAIN;

  async generate(
    request: RuntimeRequest,
    model: ModelDefinition,
    context: ProviderExecutionContext,
  ): Promise<RuntimeResponse> {
    assertAdapterOwnsModel(this, model);
    assertHasMessages(request);

    const apiKey = await resolveApiKey(context, geminiCredentialRef(), this.providerId);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const body = mapRuntimeMessagesToGemini(request.messages);
    if (request.tools?.length && request.responseFormat) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        "Gemini adapter does not support tools and response_format on the same request",
        false,
      );
    }
    const structured = mapRuntimeResponseFormatToGemini(request.responseFormat);
    body.generationConfig = {
      ...(request.expectedOutputTokens != null
        ? { maxOutputTokens: request.expectedOutputTokens }
        : {}),
      ...(structured ?? {}),
    };
    if (!body.generationConfig || Object.keys(body.generationConfig).length === 0) {
      delete body.generationConfig;
    }
    const tools = mapRuntimeToolsToGemini(request.tools);
    if (tools) body.tools = tools;
    const toolConfig = mapRuntimeToolChoiceToGemini(request.toolChoice);
    if (toolConfig) body.toolConfig = toolConfig;

    const url = `${GEMINI_BASE.replace(/\/$/, "")}/models/${encodeURIComponent(model.modelId)}:generateContent`;
    const fetchImpl = context.fetch ?? fetch;
    const { rateLimit, bodyText } = await providerFetchJson({
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
      fetchImpl,
      timeoutMs: resolveTimeoutMs(context),
      outerSignal: context.signal,
      secrets: [apiKey],
    });

    const payload = parseJsonBody(bodyText, [apiKey]);
    const content = extractGeminiText(payload);
    const toolCalls = extractGeminiToolCalls(payload);
    const usageRaw = extractGeminiUsage(payload);
    const { usage, usageMissing } = usageFromPartial(usageRaw);
    const candidate = (payload as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<Record<string, unknown>> };
      }>;
    }).candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const finishReason = toolCalls?.length
      ? ("tool_call" as const)
      : mapGeminiFinishReason(candidate?.finishReason);

    return buildSuccessResponse({
      request: request,
      providerId: this.providerId,
      registryModelId: model.id,
      providerModelSlug: model.modelId,
      content,
      toolCalls,
      usage,
      usageMissing,
      latencyMs: Date.now() - startedMs,
      finishReason,
      startedAt,
      rateLimit,
      rawMetadata: {
        providerKind: "gemini",
        toolCallCount: toolCalls?.length ?? 0,
        responseFormatType: request.responseFormat?.type,
        schemaPresent: request.responseFormat?.type === "json_schema",
        geminiFinishReason: candidate?.finishReason,
        geminiPartCount: parts.length,
        geminiPartKeys: parts.map((part) => Object.keys(part).sort().join("|")).slice(0, 8),
      },
    });
  }
}

export function createGeminiAdapter(): ProviderAdapter {
  return new GeminiAdapter();
}
