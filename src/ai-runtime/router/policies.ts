import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import type { FallbackPolicy } from "@/ai-runtime/domain/routing";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry/providers";

/** Registry internal model IDs in default routing preference order per workload. */
export const WORKLOAD_MODEL_ORDER: Record<WorkloadClass, readonly string[]> = {
  classification: [
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  extraction: [
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  summarization: [
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  content_draft: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  reasoning: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  analysis: [
    AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  governance: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  manager_decision: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
};

export const MODEL_DISPLAY_LABELS: Record<string, string> = {
  [AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY]: "Gemini",
  [AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY]: "Gemini Secondary",
  [AI_MODEL_IDS.OPENROUTER_FREE]: "OpenRouter",
  [AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B]: "NVIDIA",
};

export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  [AI_PROVIDER_IDS.GEMINI_MAIN]: "Gemini",
  [AI_PROVIDER_IDS.OPENROUTER_MAIN]: "OpenRouter",
  [AI_PROVIDER_IDS.NVIDIA_MAIN]: "NVIDIA",
};

/** Capability axis used per workload for fit scoring (0–5 scale from model capabilities). */
export const WORKLOAD_CAPABILITY_AXIS: Record<
  WorkloadClass,
  keyof import("@/ai-runtime/domain/model").ModelCapabilities
> = {
  classification: "extraction",
  extraction: "extraction",
  summarization: "summarization",
  content_draft: "writing",
  reasoning: "reasoning",
  analysis: "reasoning",
  governance: "reasoning",
  manager_decision: "reasoning",
};

/** Workloads where provider-managed free routing is deprioritized by default. */
export const QUALITY_SENSITIVE_WORKLOADS = new Set<WorkloadClass>([
  "governance",
  "manager_decision",
]);

export const WORKLOAD_FALLBACK_ORDER: Record<WorkloadClass, readonly FallbackPolicy[]> = {
  classification: ["cheaper", "equivalent", "fail"],
  extraction: ["cheaper", "equivalent", "fail"],
  summarization: ["cheaper", "equivalent", "fail"],
  content_draft: ["equivalent", "cheaper", "fail"],
  reasoning: ["equivalent", "cheaper", "fail"],
  analysis: ["equivalent", "cheaper", "fail"],
  governance: ["equivalent", "queue", "fail"],
  manager_decision: ["equivalent", "queue", "fail"],
};

export const ROUTING_SCORE_WEIGHTS = {
  capabilityMultiplier: 8,
  quotaHealth: {
    green: 30,
    yellow: 10,
    unknown: 0,
    red: -30,
    blocked: -1000,
  } as const,
  freeTierBonus: {
    background: 25,
    normal: 15,
    high: 5,
    critical: 0,
  },
  qualitySensitiveProviderManagedPenalty: 40,
  preferredProviderBonus: 20,
  preferredModelBonus: 30,
  policyRankBonus: 12,
  secondaryGeminiPenalty: 15,
} as const;

export const ROUTING_LEDGER_MAX_ENTRIES = 2_000;
export const ROUTING_LEDGER_RETENTION_MS = 24 * 60 * 60 * 1000;
export const ROUTING_LEDGER_RECENT_LIMIT = 20;

export function formatWorkloadPolicyOrder(workload: WorkloadClass): string[] {
  return WORKLOAD_MODEL_ORDER[workload].map(
    (modelId) => MODEL_DISPLAY_LABELS[modelId] ?? modelId,
  );
}
