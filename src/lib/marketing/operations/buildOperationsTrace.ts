import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import type { MarketingOperationsTrace } from "@/lib/marketing/operations/types";

export function buildMarketingOperationsTrace(input: {
  businessDateKst: string;
  run: DailyMarketingRun | null;
  candidate: CompletedMarketingCandidate | null;
  review: HumanMarketingReview | null;
  performanceSnapshotIds?: string[];
  researchSignalExternalIds?: string[];
}): MarketingOperationsTrace {
  return {
    businessDateKst: input.businessDateKst,
    logicalRunKey: input.run?.logicalRunKey ?? input.candidate?.logicalRunKey ?? null,
    runId: input.run?.runId ?? input.candidate?.runId ?? null,
    correlationId: input.run?.correlationId ?? input.candidate?.provenance.correlationId ?? null,
    assignmentId: input.run?.assignmentId ?? input.candidate?.contentAssignment.assignmentId ?? null,
    governanceReviewId:
      input.run?.governanceReviewId ?? input.candidate?.provenance.governanceReviewId ?? null,
    candidateId: input.candidate?.candidateId ?? input.run?.completedCandidateId ?? null,
    reviewId: input.review?.reviewId ?? null,
    performanceSnapshotIds: input.performanceSnapshotIds ?? [],
    researchSignalExternalIds: input.researchSignalExternalIds ?? [],
  };
}
