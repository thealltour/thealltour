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
  extractOpenAiToolCalls,
  extractOpenAiUsage,
  extractOpenRouterActualModel,
  mapOpenAiFinishReason,
  mapRuntimeMessagesToOpenAiChat,
  mapRuntimeToolChoiceToOpenAi,
  mapRuntimeToolsToOpenAi,
  mapRuntimeResponseFormatToOpenAi,
  type OpenAiChatRequestBody,
} from "@/ai-runtime/adapters/openrouter/mapper";

const OPENROUTER_BASE =
  process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

function openRouterCredentialRef(): string {
  const provider = DEFAULT_AI_PROVIDERS.find((row) => row.id === AI_PROVIDER_IDS.OPENROUTER_MAIN);
  return provider?.credentialRef ?? "ai-provider/openrouter/main";
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly providerId = AI_PROVIDER_IDS.OPENROUTER_MAIN;

  async generate(
    request: RuntimeRequest,
    model: ModelDefinition,
    context: ProviderExecutionContext,
  ): Promise<RuntimeResponse> {
    assertAdapterOwnsModel(this, model);
    assertHasMessages(request);

    const apiKey = await resolveApiKey(context, openRouterCredentialRef(), this.providerId);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const body: OpenAiChatRequestBody = {
      model: model.modelId,
      messages: mapRuntimeMessagesToOpenAiChat(request.messages),
    };
    if (request.expectedOutputTokens != null) {
      body.max_tokens = request.expectedOutputTokens;
    }
    const tools = mapRuntimeToolsToOpenAi(request.tools);
    if (tools) body.tools = tools;
    const toolChoice = mapRuntimeToolChoiceToOpenAi(request.toolChoice);
    if (toolChoice) body.tool_choice = toolChoice;
    const responseFormat = mapRuntimeResponseFormatToOpenAi(request.responseFormat);
    if (responseFormat) body.response_format = responseFormat;

    const fetchImpl = context.fetch ?? fetch;
    const { rateLimit, bodyText } = await providerFetchJson({
      url: `${OPENROUTER_BASE.replace(/\/$/, "")}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://thealltour.local",
          "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "thealltour-ai-runtime",
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
    const toolCalls = extractOpenAiToolCalls(payload);
    const usageRaw = extractOpenAiUsage(payload);
    const { usage, usageMissing } = usageFromPartial(usageRaw);
    const choice = (payload as { choices?: Array<{ finish_reason?: string }> }).choices?.[0];
    const actualBackendModel = extractOpenRouterActualModel(payload);
    const finishReason = toolCalls?.length
      ? ("tool_call" as const)
      : mapOpenAiFinishReason(choice?.finish_reason);

    return buildSuccessResponse({
      request,
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
        providerKind: "openrouter",
        toolCallCount: toolCalls?.length ?? 0,
        responseFormatType: request.responseFormat?.type,
        schemaPresent: request.responseFormat?.type === "json_schema",
        requestedModel: model.modelId,
        ...(actualBackendModel ? { actualBackendModel } : {}),
        routingMode: model.metadata?.routingMode,
      },
    });
  }
}

export function createOpenRouterAdapter(): ProviderAdapter {
  return new OpenRouterAdapter();
}
