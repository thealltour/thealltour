export const DAILY_MARKETING_OPERATING_CYCLE_CONTRACT = "daily-marketing-operating-cycle-v1" as const;

export type OperationsStageStatus =
  | "healthy"
  | "degraded"
  | "failed"
  | "pending"
  | "not_applicable"
  | "action_required";

export type DailyMarketingOverallStatus = "healthy" | "degraded" | "action_required" | "failed";

export type DailyMarketingOperatingCycle = {
  contract: typeof DAILY_MARKETING_OPERATING_CYCLE_CONTRACT;
  businessDateKst: string;
  research: {
    status: OperationsStageStatus;
    signalCount: number | null;
    briefCount: number | null;
    degradedSources: string[];
    message: string;
  };
  performanceBrief: {
    status: OperationsStageStatus;
    snapshotCount: number | null;
    artifactGeneratedAt: string | null;
    degradedSources: string[];
    message: string;
  };
  marketingRun: {
    runId: string | null;
    logicalRunKey: string;
    status: OperationsStageStatus;
    runStatus: string | null;
    failureReason: string | null;
    message: string;
  };
  candidate: {
    candidateId: string | null;
    status: string | null;
    governanceDecision: string | null;
    duplicateCount: number;
    message: string;
  };
  humanReview: {
    reviewId: string | null;
    status: string | null;
    message: string;
  };
  feedback: {
    performanceSignalsAvailable: boolean;
    advisoryEvidenceAvailable: boolean;
    snapshotCount: number;
    message: string;
  };
  overallStatus: DailyMarketingOverallStatus;
  actionRequiredReasons: string[];
  observedAt: string;
  trace: MarketingOperationsTrace;
};

export type MarketingOperationsTrace = {
  businessDateKst: string;
  logicalRunKey: string | null;
  runId: string | null;
  correlationId: string | null;
  assignmentId: string | null;
  governanceReviewId: string | null;
  candidateId: string | null;
  reviewId: string | null;
  performanceSnapshotIds: string[];
  researchSignalExternalIds: string[];
};

export type MarketingOperationsSummary = {
  businessDateKst: string;
  overallStatus: DailyMarketingOverallStatus;
  marketingRunStatus: string | null;
  candidateStatus: string | null;
  humanReviewStatus: string | null;
  failureReason: string | null;
  actionRequiredReasons: string[];
};

export type GetDailyMarketingOperationsStatusOptions = {
  businessDateKst?: string;
  now?: Date;
  includeVerification?: boolean;
};

import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";

export type GetDailyMarketingOperationsStatusDeps = {
  now?: Date;
  performanceBriefPath?: string;
  checkSemanticInfrastructure?: () => Promise<boolean>;
  runRepo?: DailyMarketingRunRepository;
  reviewRepo?: HumanMarketingReviewRepository;
  perfRepo?: ContentPerformanceRepository;
  researchRepo?: ResearchRepository;
};
