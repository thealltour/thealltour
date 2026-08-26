import type { WorkloadClass } from "@/ai-runtime/domain/workload";

export const FALLBACK_POLICIES = ["cheaper", "equivalent", "queue", "fail"] as const;

export type FallbackPolicy = (typeof FALLBACK_POLICIES)[number];

export interface WorkloadRoutingPolicy {
  workload: WorkloadClass;
  fallbackOrder: FallbackPolicy[];
  minimumCapabilityScore?: number;
  maxEstimatedCostUsd?: number;
  maxQueueWaitMs?: number;
}
