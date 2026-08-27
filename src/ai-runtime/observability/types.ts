import type { ProviderKind } from "@/ai-runtime/domain/provider";
import type { QuotaHealth } from "@/ai-runtime/domain/quota";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";

export type AdapterReadiness = "ready" | "unavailable";

export type RuntimeQuotaSnapshotDto = {
  health: QuotaHealth;
  minuteRequests: number;
  minuteTokens?: number;
  minuteTokensKnown: boolean;
  dayRequests: number;
  dayTokens?: number;
  dayTokensKnown: boolean;
  configured?: {
    rpm?: number;
    tpm?: number;
    rpd?: number;
    tpd?: number;
  };
  observed?: {
    limitRequests?: number;
    remainingRequests?: number;
    limitTokens?: number;
    remainingTokens?: number;
    resetRequestsAt?: string;
    resetTokensAt?: string;
  };
  retryAfterMs?: number;
  blockedUntil?: string;
};

export type RuntimeReservationSnapshotDto = {
  activeReservations: number;
  reservedRequests: number;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  reservedTotalTokens: number;
};

export type RuntimeModelStatusDto = {
  id: string;
  displayName: string;
  modelSlug: string;
  routingEnabled: boolean;
  eligible: boolean;
  workloads: WorkloadClass[];
  providerManaged: boolean;
  freeTierEligible: boolean;
  quota?: RuntimeQuotaSnapshotDto;
  reservation?: RuntimeReservationSnapshotDto;
};

export type RuntimeProviderStatusDto = {
  id: string;
  displayName: string;
  kind: ProviderKind;
  enabled: boolean;
  adapterReadiness: AdapterReadiness;
  credentialConfigured: boolean;
  disabledReason?: string;
  registeredModelCount: number;
  models: RuntimeModelStatusDto[];
  quota?: RuntimeQuotaSnapshotDto;
  reservation?: RuntimeReservationSnapshotDto;
};

export type RuntimeStatusSummaryDto = {
  enabledProviders: number;
  disabledProviders: number;
  registeredModels: number;
  adaptersReady: number;
  activeReservations: number;
};

export type RuntimeStatusDto = {
  generatedAt: string;
  summary: RuntimeStatusSummaryDto;
  routing?: RuntimeRoutingStatusDto;
  routingPolicies?: RuntimeRoutingPolicyDto[];
  /** Live queue/running — this process only. */
  scheduler?: RuntimeSchedulerStatusDto;
  providers: RuntimeProviderStatusDto[];
  /** Shared historical telemetry from PostgreSQL (cross-process). */
  shared?: import("@/ai-runtime/observability/persistence").SharedRuntimeTelemetryDto;
};

export type RuntimeRoutingStatusDto = {
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

export type RuntimeRoutingPolicyDto = {
  workload: WorkloadClass;
  orderLabels: string[];
};

export type RuntimeSchedulerStatusDto = {
  queued: number;
  runnable: number;
  deferred: number;
  running: number;
  completedLastHour: number;
  failedLastHour: number;
  cancelled: number;
  recent: Array<{
    jobId: string;
    agentId: string;
    source: string;
    workload: WorkloadClass;
    priority: string;
    status: string;
    attempts: number;
    queuedAt: string;
    availableAt?: string;
    startedAt?: string;
    completedAt?: string;
    lastErrorCode?: string;
    deferReason?: string;
    correlationId?: string;
    cronJobId?: string;
  }>;
};
