import type { ProviderDefinition } from "@/ai-runtime/domain/provider";

/** Stable internal provider registry IDs (not credential material). */
export const AI_PROVIDER_IDS = {
  GEMINI_MAIN: "gemini-main",
  OPENROUTER_MAIN: "openrouter-main",
  GROQ_MAIN: "groq-main",
  NVIDIA_MAIN: "nvidia-main",
} as const;

export type AiProviderRegistryId = (typeof AI_PROVIDER_IDS)[keyof typeof AI_PROVIDER_IDS];

/**
 * Default logical providers.
 * Secrets resolve later via credentialRef — never embed API keys here.
 * Toggle `enabled` in config overrides without coupling to key presence.
 */
export const DEFAULT_AI_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: AI_PROVIDER_IDS.GEMINI_MAIN,
    kind: "gemini",
    displayName: "Gemini",
    enabled: true,
    credentialRef: "ai-provider/gemini/main",
    quotaScope: "project",
    metadata: { vendor: "google" },
  },
  {
    id: AI_PROVIDER_IDS.OPENROUTER_MAIN,
    kind: "openrouter",
    displayName: "OpenRouter",
    enabled: true,
    credentialRef: "ai-provider/openrouter/main",
    quotaScope: "account",
    metadata: { vendor: "openrouter" },
  },
  {
    id: AI_PROVIDER_IDS.GROQ_MAIN,
    kind: "groq",
    displayName: "Groq",
    // Kept in catalog for easy re-enable once Hermes invocation works again.
    enabled: false,
    credentialRef: "ai-provider/groq/main",
    quotaScope: "account",
    metadata: {
      vendor: "groq",
      statusReason: "Hermes provider invocation unavailable",
    },
  },
  {
    id: AI_PROVIDER_IDS.NVIDIA_MAIN,
    kind: "nvidia",
    displayName: "NVIDIA NIM",
    enabled: true,
    credentialRef: "ai-provider/nvidia/main",
    // Hosted NIM keys are typically account-scoped (same pattern as OpenRouter/Groq).
    quotaScope: "account",
    metadata: { vendor: "nvidia" },
  },
] as const;
