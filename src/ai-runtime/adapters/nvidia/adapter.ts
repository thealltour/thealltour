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
  extractOpenAiChatContent,
  extractOpenAiUsage,
  mapOpenAiFinishReason,
  mapRuntimeMessagesToOpenAiChat,
  type OpenAiChatRequestBody,
} from "@/ai-runtime/adapters/nvidia/mapper";

const NVIDIA_BASE =
  process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1";

function nvidiaCredentialRef(): string {
  const provider = DEFAULT_AI_PROVIDERS.find((row) => row.id === AI_PROVIDER_IDS.NVIDIA_MAIN);
  return provider?.credentialRef ?? "ai-provider/nvidia/main";
}

export class NvidiaAdapter implements ProviderAdapter {
  readonly providerId = AI_PROVIDER_IDS.NVIDIA_MAIN;

  async generate(
    request: RuntimeRequest,
    model: ModelDefinition,
    context: ProviderExecutionContext,
  ): Promise<RuntimeResponse> {
    assertAdapterOwnsModel(this, model);
    assertHasMessages(request);

    const apiKey = await resolveApiKey(context, nvidiaCredentialRef(), this.providerId);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const body: OpenAiChatRequestBody = {
      model: model.modelId,
      messages: mapRuntimeMessagesToOpenAiChat(request.messages),
    };
    if (request.expectedOutputTokens != null) {
      body.max_tokens = request.expectedOutputTokens;
    }

    const fetchImpl = context.fetch ?? fetch;
    const { rateLimit, bodyText } = await providerFetchJson({
      url: `${NVIDIA_BASE.replace(/\/$/, "")}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      fetchImpl,
      timeoutMs: resolveTimeoutMs(context),
      outerSignal: context.signal,
      secrets: [apiKey],
    });

    const payload = parseJsonBody(bodyText, [apiKey]);
    const content = extractOpenAiChatContent(payload);
    const usageRaw = extractOpenAiUsage(payload);
    const { usage, usageMissing } = usageFromPartial(usageRaw);
    const choice = (payload as { choices?: Array<{ finish_reason?: string }> }).choices?.[0];

    return buildSuccessResponse({
      request,
      providerId: this.providerId,
      registryModelId: model.id,
      providerModelSlug: model.modelId,
      content,
      usage,
      usageMissing,
      latencyMs: Date.now() - startedMs,
      finishReason: mapOpenAiFinishReason(choice?.finish_reason),
      startedAt,
      rateLimit,
      rawMetadata: {
        providerKind: "nvidia",
      },
    });
  }
}

export function createNvidiaAdapter(): ProviderAdapter {
  return new NvidiaAdapter();
}
