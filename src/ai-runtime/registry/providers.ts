import type { ProviderDefinition } from "@/ai-runtime/domain/provider";

/** Stable internal provider registry IDs (not credential material). */
export const AI_PROVIDER_IDS = {
  GEMINI_MAIN: "gemini-main",
  OPENROUTER_MAIN: "openrouter-main",
  GROQ_MAIN: "groq-main",
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
    // Entry exists for future models; keep enabled so registry stays usable
    // even before a key exists. Adapters (later) must still resolve credentials.
    enabled: true,
    credentialRef: "ai-provider/groq/main",
    quotaScope: "account",
    metadata: { vendor: "groq" },
  },
] as const;
