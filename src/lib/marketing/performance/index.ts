export * from "@/lib/marketing/performance/types";
export * from "@/lib/marketing/performance/constants";
export * from "@/lib/marketing/performance/eligibility";
export * from "@/lib/marketing/performance/capabilityMatrix";
export * from "@/lib/marketing/performance/idempotency";
export * from "@/lib/marketing/performance/normalizeFeatures";
export * from "@/lib/marketing/performance/observability";
export * from "@/lib/marketing/performance/adapters/types";
export * from "@/lib/marketing/performance/adapters/createMetricsAdapter";
export * from "@/lib/marketing/performance/repository/contracts";
export * from "@/lib/marketing/performance/repository/createContentPerformanceRepository";
export * from "@/lib/marketing/performance/services/manualPublicationCollectionService";
export * from "@/lib/marketing/performance/memory/performanceEvidence";
export * from "@/lib/marketing/performance/research/performanceSignalAdapter";
export * from "@/lib/marketing/performance/integration/performanceAnalystInput";
export * from "@/lib/marketing/performance/integration/marketingManagerPerformanceContext";
export * from "@/lib/marketing/performance/integration/enrichPerformanceBrief";

export const PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9 = 0 as const;
