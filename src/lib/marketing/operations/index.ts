export {
  getDailyMarketingOperationsStatus,
  getRecentDailyMarketingOperationsSummaries,
  sanitizeOperationsDtoForResponse,
} from "@/lib/marketing/operations/getDailyMarketingOperationsStatus";
export {
  DEGRADED_DEPENDENCY_MATRIX,
  OBSERVABILITY_GAPS,
  type DegradedDependencyBehavior,
  type DegradedDependencyScenario,
} from "@/lib/marketing/operations/degradedDependencyMatrix";
export { buildMarketingOperationsTrace } from "@/lib/marketing/operations/buildOperationsTrace";
export {
  buildMarketingIncidentTriage,
  snapshotFailedRunForIncidentHistory,
} from "@/lib/marketing/operations/buildIncidentTriage";
export {
  classifyMarketingIncident,
  mapPipelineFailureToReason,
  type MarketingIncidentClass,
  type RecoveryDisposition,
} from "@/lib/marketing/operations/incidentClassification";
export {
  buildActionRequiredReasons,
  classifyOverallStatus,
  isBeforeMarketingRunDue,
  isBeforePerformanceBriefDue,
  mapRunToStageStatus,
} from "@/lib/marketing/operations/healthRules";
export { OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10 } from "@/lib/marketing/social/publication/governanceBoundary";
export {
  filterProductionRecords,
  isVerificationRecord,
  STEP_3_10_VERIFICATION_PURPOSE,
  STEP_3_10_VERIFICATION_ROUTINE_ID,
  VERIFICATION_CANDIDATE_IDS,
  VERIFICATION_PURPOSES,
  VERIFICATION_ROUTINE_IDS,
} from "@/lib/marketing/operations/verification";
export type {
  DailyMarketingOperatingCycle,
  DailyMarketingOverallStatus,
  GetDailyMarketingOperationsStatusDeps,
  GetDailyMarketingOperationsStatusOptions,
  MarketingOperationsSummary,
  MarketingOperationsTrace,
  OperationsStageStatus,
} from "@/lib/marketing/operations/types";
