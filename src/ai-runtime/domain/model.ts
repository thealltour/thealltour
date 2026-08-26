import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";

/**
 * Relative capability scores are 0–5 (validated by schemas).
 * Higher = stronger for that axis.
 */
export interface ModelCapabilities {
  reasoning: number;
  writing: number;
  extraction: number;
  summarization: number;
  structuredOutput: boolean;
  toolCalling: boolean;
  vision?: boolean;
}

/**
 * Optional rate/size ceilings.
 * `undefined` means unknown / not configured — never treat as unlimited.
 * Do not use `0` as a stand-in for unknown.
 */
export interface ModelLimits {
  contextTokens?: number;
  maxOutputTokens?: number;
  rpm?: number;
  tpm?: number;
  rpd?: number;
  tpd?: number;
  inputTpm?: number;
  outputTpm?: number;
}

export interface ModelEconomics {
  inputCostPerMillionTokens?: number;
  outputCostPerMillionTokens?: number;
  freeTierEligible?: boolean;
}

export interface ModelRoutingConfig {
  workloadClasses: WorkloadClass[];
  basePriority: number;
  enabled: boolean;
}

export interface ModelDefinition {
  id: string;
  providerId: ProviderDefinition["id"];
  modelId: string;
  displayName: string;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  economics: ModelEconomics;
  routing: ModelRoutingConfig;
  metadata?: Record<string, string>;
}
