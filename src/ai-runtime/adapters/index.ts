export type {
  CredentialResolver,
  ProviderAdapter,
  ProviderExecutionContext,
  ProviderRateLimitMetadata,
} from "@/ai-runtime/adapters/types";
export { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/ai-runtime/adapters/types";

export { CREDENTIAL_REF_ENV_CANDIDATES } from "@/ai-runtime/adapters/credential-resolver";
export { createEnvCredentialResolver } from "@/ai-runtime/adapters/env-credential-resolver";

export { createGeminiAdapter, GeminiAdapter } from "@/ai-runtime/adapters/gemini/adapter";
export { createOpenRouterAdapter, OpenRouterAdapter } from "@/ai-runtime/adapters/openrouter/adapter";
export { createNvidiaAdapter, NvidiaAdapter } from "@/ai-runtime/adapters/nvidia/adapter";

export {
  createDefaultProviderAdapters,
  getProviderAdapter,
  listRegisteredAdapterProviderIds,
  resetProviderAdapterCacheForTests,
} from "@/ai-runtime/adapters/resolver";

export { redactSecrets, safeErrorMessage } from "@/ai-runtime/adapters/redaction";
export { mapHttpStatusToRuntimeError, extractRateLimitMetadata } from "@/ai-runtime/adapters/http";
