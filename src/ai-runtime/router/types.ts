import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import type { QuotaHealth } from "@/ai-runtime/domain/quota";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type { ModelDefinition } from "@/ai-runtime/domain/model";

export type RoutingCandidate = {
  model: ModelDefinition;
  score: number;
  quotaHealth: QuotaHealth;
  capabilityScore: number;
  policyRank: number;
};

export interface RuntimeRoutingDecision {
  requestId: string;
  workload: WorkloadClass;
  priority: RuntimePriority;
  candidates: Array<{
    providerId: string;
    modelId: string;
    score: number;
    quotaHealth: QuotaHealth;
  }>;
  selectedProviderId?: string;
  selectedModelId?: string;
  fallbackUsed: boolean;
  attemptCount: number;
}

export type RoutingLedgerEntry = {
  id: string;
  timestamp: string;
  requestId: string;
  correlationId?: string;
  workload: WorkloadClass;
  priority: RuntimePriority;
  candidateCount: number;
  attemptCount: number;
  selectedProviderId?: string;
  selectedModelId?: string;
  fallbackUsed: boolean;
  finalStatus: "success" | "failed";
  finalErrorCode?: string;
};

export type RoutingLedgerSnapshot = {
  lastHourRequests: number;
  fallbackCount: number;
  fallbackRate: number;
  providerSelections: Record<string, number>;
  recent: Array<{
    timestamp: string;
    workload: WorkloadClass;
    selectedProviderId?: string;
    selectedModelId?: string;
    attemptCount: number;
    fallbackUsed: boolean;
    finalStatus: "success" | "failed";
  }>;
};

export type WorkloadPolicyDisplay = {
  workload: WorkloadClass;
  orderLabels: string[];
};
