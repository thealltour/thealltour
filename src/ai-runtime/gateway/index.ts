export {
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_INTEGRATION,
  AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV,
} from "@/ai-runtime/integration/constants";
export { handleOpenAiCompatChatCompletion } from "@/ai-runtime/gateway/openai-compat";
export {
  assertInferenceGatewayAuth,
  InferenceGatewayAuthError,
  isPrivateClientAddress,
  readInferenceGatewayToken,
} from "@/ai-runtime/gateway/auth";
export {
  mapOpenAiCompatToRuntimeRequest,
  mapOpenAiResponseFormatToRuntime,
  mapOpenAiMessagesToRuntime,
  mapOpenAiToolsToRuntime,
  mapOpenAiToolChoiceToRuntime,
  resolveWorkloadForAlias,
  extractCompatibilityFlags,
} from "@/ai-runtime/gateway/request-mapper";
export {
  mapRuntimeResponseToOpenAiCompat,
  mapRuntimeResponseToOpenAiSse,
} from "@/ai-runtime/gateway/response-mapper";
export { mapRuntimeErrorCodeToHttp, mapUnknownToHttp } from "@/ai-runtime/gateway/error-mapper";
export type {
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatChatCompletionResponse,
  GatewayCompatibilityFlags,
} from "@/ai-runtime/gateway/types";
