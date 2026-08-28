export {
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
  HERMES_INFERENCE_INTEGRATION,
  AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV,
  AI_RUNTIME_SPIKE_FORCE_FALLBACK_ENV,
  RUNTIME_SPIKE_AGENT_ID,
  SPIKE_FORCE_FALLBACK_DETAIL,
} from "@/ai-runtime/integration/constants";
export { handleOpenAiCompatChatCompletion } from "@/ai-runtime/gateway/openai-compat";
export {
  assertInferenceGatewayAuth,
  InferenceGatewayAuthError,
  isPrivateClientAddress,
  readInferenceGatewayToken,
} from "@/ai-runtime/gateway/auth";
export {
  HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
  HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
  HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
  HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
  listGatewayAliasEntries,
  lookupGatewayAlias,
  resolveGatewayAlias,
  isProductionGatewayAlias,
  isSpikeGatewayAlias,
} from "@/ai-runtime/gateway/alias-registry";
export { validateHermesRuntimeCutoverConfig, isBareCustomProvider } from "@/ai-runtime/gateway/cutover-preflight";
export type {
  HermesRuntimeCutoverConfigInput,
  HermesRuntimeCutoverValidationResult,
  HermesRuntimeCutoverValidationOptions,
  HermesProviderBlock,
} from "@/ai-runtime/gateway/cutover-preflight";
export {
  loadHermesExecutionEnvScope,
  type HermesExecutionEnvScope,
  type HermesEnvKeySet,
} from "@/ai-runtime/gateway/hermes-env-scope";
export {
  mapOpenAiCompatToRuntimeRequest,
  mapOpenAiResponseFormatToRuntime,
  mapOpenAiMessagesToRuntime,
  mapOpenAiToolsToRuntime,
  mapOpenAiToolChoiceToRuntime,
  resolveWorkloadForAlias,
  extractCompatibilityFlags,
  shouldSpikeForceFallback,
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
