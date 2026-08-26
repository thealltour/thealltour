import type { ModelDefinition } from "@/ai-runtime/domain/model";
import { WORKLOAD_CLASSES } from "@/ai-runtime/domain/workload";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry/providers";

/** Stable internal model registry IDs (distinct from provider model slugs). */
export const AI_MODEL_IDS = {
  GEMINI_FLASH_LITE_PRIMARY: "gemini-flash-lite-primary",
  GEMINI_FLASH_LITE_SECONDARY: "gemini-flash-lite-secondary",
  OPENROUTER_FREE: "openrouter-free",
} as const;

export type AiModelRegistryId = (typeof AI_MODEL_IDS)[keyof typeof AI_MODEL_IDS];

const ALL_WORKLOADS = [...WORKLOAD_CLASSES];

const OPENROUTER_FREE_WORKLOADS = [
  "classification",
  "extraction",
  "summarization",
  "content_draft",
  "reasoning",
] as const;

/**
 * Default model catalog.
 * Provider model slugs live only here — other runtime code should use AI_MODEL_IDS.
 * Groq models intentionally omitted until a real slug is chosen (empty by default).
 */
export const DEFAULT_AI_MODELS: readonly ModelDefinition[] = [
  {
    id: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash-Lite (primary)",
    capabilities: {
      reasoning: 4,
      writing: 4,
      extraction: 4,
      summarization: 4,
      structuredOutput: true,
      toolCalling: true,
    },
    // Rate limits are account/tier dependent — leave unknown (undefined).
    limits: {},
    economics: {},
    routing: {
      workloadClasses: ALL_WORKLOADS,
      basePriority: 80,
      enabled: true,
    },
    metadata: { routingMode: "fixed" },
  },
  {
    id: AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash-Lite (secondary)",
    capabilities: {
      reasoning: 3,
      writing: 3,
      extraction: 4,
      summarization: 4,
      structuredOutput: true,
      toolCalling: true,
    },
    limits: {},
    economics: {},
    routing: {
      workloadClasses: ALL_WORKLOADS,
      basePriority: 60,
      enabled: true,
    },
    metadata: { routingMode: "fixed" },
  },
  {
    id: AI_MODEL_IDS.OPENROUTER_FREE,
    providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
    modelId: "openrouter/free",
    displayName: "OpenRouter Free Pool",
    capabilities: {
      reasoning: 3,
      writing: 3,
      extraction: 3,
      summarization: 3,
      structuredOutput: true,
      toolCalling: false,
    },
    limits: {},
    economics: {
      freeTierEligible: true,
    },
    routing: {
      workloadClasses: [...OPENROUTER_FREE_WORKLOADS],
      basePriority: 40,
      enabled: true,
    },
    metadata: {
      routingMode: "provider-managed",
      modelPool: "free",
    },
  },
] as const;

/**
 * Helper for config overrides: append models (e.g. Groq or OpenRouter `:free` slugs)
 * without hardcoding guessed provider model IDs in application logic.
 */
export function withAdditionalModels(
  base: readonly ModelDefinition[],
  extra: readonly ModelDefinition[],
): ModelDefinition[] {
  return [...base, ...extra];
}
