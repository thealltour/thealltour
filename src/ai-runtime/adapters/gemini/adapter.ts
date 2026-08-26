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
  extractGeminiUsage,
  mapGeminiFinishReason,
  mapRuntimeMessagesToGemini,
} from "@/ai-runtime/adapters/gemini/mapper";

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
    if (request.expectedOutputTokens != null) {
      body.generationConfig = { maxOutputTokens: request.expectedOutputTokens };
    }

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
    const usageRaw = extractGeminiUsage(payload);
    const { usage, usageMissing } = usageFromPartial(usageRaw);
    const candidate = (payload as { candidates?: Array<{ finishReason?: string }> }).candidates?.[0];

    return buildSuccessResponse({
      request: request,
      providerId: this.providerId,
      registryModelId: model.id,
      providerModelSlug: model.modelId,
      content,
      usage,
      usageMissing,
      latencyMs: Date.now() - startedMs,
      finishReason: mapGeminiFinishReason(candidate?.finishReason),
      startedAt,
      rateLimit,
      rawMetadata: {
        providerKind: "gemini",
      },
    });
  }
}

export function createGeminiAdapter(): ProviderAdapter {
  return new GeminiAdapter();
}
