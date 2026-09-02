import "server-only";

import {
  buildLogicalDailyRunKey,
  formatKstBusinessDate,
} from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  DAILY_MARKETING_ROUTINE_ID,
} from "@/lib/marketing/cron/daily/types";
import { createDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { readLatestPerformanceBrief } from "@/lib/marketing/cron/performanceBriefArtifact";
import { createHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { isCandidateEligibleForHumanReview } from "@/lib/marketing/review/bootstrap/eligibility";
import { createContentPerformanceRepository } from "@/lib/marketing/performance/repository/createContentPerformanceRepository";
import { performanceSnapshotExternalId } from "@/lib/marketing/performance/constants";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createResearchRepository } from "@/lib/marketing/research/repository/createResearchRepository";
import { buildMarketingIncidentTriage } from "@/lib/marketing/operations/buildIncidentTriage";
import { buildMarketingOperationsTrace } from "@/lib/marketing/operations/buildOperationsTrace";
import {
  buildActionRequiredReasons,
  classifyOverallStatus,
  isBeforeMarketingRunDue,
  isBeforePerformanceBriefDue,
  mapRunToStageStatus,
} from "@/lib/marketing/operations/healthRules";
import { isVerificationRecord } from "@/lib/marketing/operations/verification";
import {
  DAILY_MARKETING_OPERATING_CYCLE_CONTRACT,
  type DailyMarketingOperatingCycle,
  type GetDailyMarketingOperationsStatusDeps,
  type GetDailyMarketingOperationsStatusOptions,
  type MarketingOperationsSummary,
  type OperationsStageStatus,
} from "@/lib/marketing/operations/types";

function businessDateEndIso(businessDateKst: string): Date {
  return new Date(`${businessDateKst}T23:59:59.000+09:00`);
}

function businessDateStartIso(businessDateKst: string): string {
  return `${businessDateKst}T00:00:00.000+09:00`;
}

function artifactMatchesBusinessDate(generatedAt: string, businessDateKst: string): boolean {
  return formatKstBusinessDate(new Date(generatedAt)) === businessDateKst;
}

function classifyResearchStage(input: {
  contextStatus: string;
  briefCount: number;
  semanticOk: boolean;
  businessDateKst: string;
  now: Date;
}): { status: OperationsStageStatus; message: string; degradedSources: string[] } {
  const degradedSources: string[] = [];
  if (!input.semanticOk) degradedSources.push("bge_m3");

  if (input.contextStatus === "unavailable") {
    return {
      status: "failed",
      message: "Research context unavailable; check Supabase research tables and repository connectivity.",
      degradedSources,
    };
  }

  if (input.contextStatus === "empty") {
    return {
      status: isBeforeMarketingRunDue(input.now, input.businessDateKst) ? "degraded" : "failed",
      message: isBeforeMarketingRunDue(input.now, input.businessDateKst)
        ? "No eligible research briefs yet; 09:00 run may defer if collection has not run."
        : "No eligible research briefs in lookback window; 09:00 run likely deferred or failed.",
      degradedSources,
    };
  }

  if (input.contextStatus === "degraded") {
    degradedSources.push("semantic_infrastructure");
  }

  return {
    status: input.contextStatus === "degraded" ? "degraded" : "healthy",
    message:
      input.contextStatus === "degraded"
        ? "Research completed with degraded semantic infrastructure; lexical fallback in effect."
        : `Research context available with ${input.briefCount} brief(s) in MM window.`,
    degradedSources,
  };
}

function classifyPerformanceBriefStage(input: {
  artifactGeneratedAt: string | null;
  artifactMatchesDate: boolean;
  snapshotCount: number;
  businessDateKst: string;
  now: Date;
}): { status: OperationsStageStatus; message: string; degradedSources: string[] } {
  const degradedSources: string[] = [];

  if (!input.artifactGeneratedAt) {
    return {
      status: isBeforePerformanceBriefDue(input.now, input.businessDateKst) ? "pending" : "degraded",
      message: isBeforePerformanceBriefDue(input.now, input.businessDateKst)
        ? "08:30 Performance Analyst brief has not run yet for this business date."
        : "No 08:30 performance brief artifact found on disk.",
      degradedSources: ["performance_artifact_missing"],
    };
  }

  if (!input.artifactMatchesDate) {
    degradedSources.push("performance_artifact_stale");
    return {
      status: "degraded",
      message: `Latest performance brief artifact is from ${formatKstBusinessDate(new Date(input.artifactGeneratedAt))}, not ${input.businessDateKst}.`,
      degradedSources,
    };
  }

  if (input.snapshotCount === 0) {
    degradedSources.push("manual_performance_snapshots_absent");
  }

  return {
    status: input.snapshotCount === 0 ? "degraded" : "healthy",
    message:
      input.snapshotCount === 0
        ? "08:30 brief ran but no manual performance snapshots were available (optional feedback)."
        : `08:30 brief ran with ${input.snapshotCount} manual performance snapshot(s).`,
    degradedSources,
  };
}

export async function getDailyMarketingOperationsStatus(
  options: GetDailyMarketingOperationsStatusOptions = {},
  deps: GetDailyMarketingOperationsStatusDeps = {},
): Promise<DailyMarketingOperatingCycle> {
  const now = deps.now ?? options.now ?? new Date();
  const businessDateKst = options.businessDateKst ?? formatKstBusinessDate(now);
  const observedAt = now.toISOString();
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst,
  });

  const [runRepo, reviewRepo, perfRepo, researchRepo] = await Promise.all([
    deps.runRepo ? Promise.resolve(deps.runRepo) : createDailyMarketingRunRepository(),
    deps.reviewRepo ? Promise.resolve(deps.reviewRepo) : createHumanMarketingReviewRepository(),
    deps.perfRepo ? Promise.resolve(deps.perfRepo) : createContentPerformanceRepository(),
    deps.researchRepo ? Promise.resolve(deps.researchRepo) : createResearchRepository(),
  ]);

  const [run, allCandidatesForDate, performanceBrief, snapshotsSince] = await Promise.all([
    runRepo.findRunByLogicalKey(logicalRunKey),
    runRepo.listCandidates({ businessDateKst, limit: 20 }),
    Promise.resolve(readLatestPerformanceBrief(deps.performanceBriefPath)),
    perfRepo.listRecent({ since: businessDateStartIso(businessDateKst), limit: 50 }),
  ]);

  const productionCandidates = options.includeVerification
    ? allCandidatesForDate
    : allCandidatesForDate.filter(
        (candidate) =>
          !isVerificationRecord({
            routineId: candidate.provenance.routineId,
            candidateId: candidate.candidateId,
            logicalRunKey: candidate.logicalRunKey,
            metadata: candidate.observability as unknown as Record<string, unknown>,
          }),
      );

  const candidate = productionCandidates[0] ?? null;
  const duplicateProductionCandidates = Math.max(0, productionCandidates.length - 1);

  const review = candidate ? await reviewRepo.findByCandidateId(candidate.candidateId) : null;

  const productionSnapshots = options.includeVerification
    ? snapshotsSince
    : snapshotsSince.filter(
        (snapshot) =>
          !isVerificationRecord({
            candidateId: snapshot.candidateId,
            logicalObservationKey: snapshot.logicalObservationKey,
          }),
      );

  const contextNow = businessDateEndIso(businessDateKst);
  const semanticOk =
    deps.checkSemanticInfrastructure !== undefined
      ? await deps.checkSemanticInfrastructure()
      : false;

  const researchContext = await getMarketingManagerResearchContext(
    { lookbackHours: 168 },
    {
      repo: researchRepo,
      now: contextNow > now ? now : contextNow,
      checkSemanticInfrastructure: async () => semanticOk,
    },
  );

  const researchStage = classifyResearchStage({
    contextStatus: researchContext.status,
    briefCount: researchContext.briefs.length,
    semanticOk,
    businessDateKst,
    now,
  });

  const performanceStage = classifyPerformanceBriefStage({
    artifactGeneratedAt: performanceBrief?.generatedAt ?? null,
    artifactMatchesDate: performanceBrief
      ? artifactMatchesBusinessDate(performanceBrief.generatedAt, businessDateKst)
      : false,
    snapshotCount: productionSnapshots.length,
    businessDateKst,
    now,
  });

  const marketingRunStage = mapRunToStageStatus(run, now, businessDateKst);

  let candidateStage: { status: OperationsStageStatus; message: string } = {
    status: "pending",
    message: "No production candidate persisted for this business date yet.",
  };

  if (candidate) {
    if (candidate.status === "failed" || candidate.status === "blocked") {
      candidateStage = {
        status: candidate.status === "failed" ? "failed" : "action_required",
        message:
          candidate.status === "failed"
            ? "Candidate persisted in failed state."
            : "Governance blocked the candidate.",
      };
    } else {
      candidateStage = {
        status: "healthy",
        message: `Production candidate ${candidate.candidateId} is ${candidate.status}.`,
      };
    }
  } else if (run?.status === "completed") {
    candidateStage = {
      status: "failed",
      message: "Daily run completed but no production candidate was found.",
    };
  }

  let humanReviewStage: { status: OperationsStageStatus; message: string } = {
    status: "not_applicable",
    message: "No production candidate; human review not applicable.",
  };

  if (candidate) {
    if (!review) {
      if (isCandidateEligibleForHumanReview(candidate)) {
        humanReviewStage = {
          status: "action_required",
          message: "Candidate exists but HumanMarketingReview bootstrap record is missing.",
        };
      } else {
        humanReviewStage = {
          status: "pending",
          message: "Human review not started.",
        };
      }
    } else if (review.status === "manually_published") {
      humanReviewStage = {
        status: "healthy",
        message: "Human marked content as manually published.",
      };
    } else if (review.status === "approved_for_manual_publish") {
      humanReviewStage = {
        status: "healthy",
        message: "Approved for manual publish; awaiting external publication by a human.",
      };
    } else if (review.status === "deferred" || review.status === "pending" || review.status === "editing") {
      humanReviewStage = {
        status: "action_required",
        message: `Human review is ${review.status}.`,
      };
    } else {
      humanReviewStage = {
        status: review.status === "rejected" ? "action_required" : "healthy",
        message: `Human review status: ${review.status}.`,
      };
    }
  }

  const perfSignals = await researchRepo.findRecentSignals({
    since: businessDateStartIso(businessDateKst),
    limit: 100,
  });
  const productionPerfSignals = perfSignals.filter(
    (signal) =>
      signal.signalType === "content_performance" &&
      (options.includeVerification ||
        !isVerificationRecord({
          candidateId: (signal.metadata as { candidateId?: string } | undefined)?.candidateId,
          purpose: (signal.metadata as { purpose?: string } | undefined)?.purpose,
          metadata: signal.metadata ?? null,
        })),
  );

  const feedback = {
    performanceSignalsAvailable: productionPerfSignals.length > 0,
    advisoryEvidenceAvailable: productionPerfSignals.some(
      (signal) => (signal.metadata as { advisoryOnly?: boolean } | undefined)?.advisoryOnly === true,
    ),
    snapshotCount: productionSnapshots.length,
    message:
      productionPerfSignals.length > 0
        ? `${productionPerfSignals.length} advisory performance signal(s) available for Research/MM context.`
        : productionSnapshots.length > 0
          ? "Performance snapshots exist but no matching Research signals were found yet."
          : "No performance feedback available (optional; not a failure).",
  };

  const actionRequiredReasons = [
    ...buildActionRequiredReasons({ candidate, review }),
    ...(duplicateProductionCandidates > 0
      ? [`Duplicate production candidates detected (${duplicateProductionCandidates + 1} total).`]
      : []),
  ];

  const overallStatus = classifyOverallStatus({
    researchStatus: researchStage.status,
    performanceBriefStatus: performanceStage.status,
    marketingRunStatus: marketingRunStage.status,
    candidateStatus: candidateStage.status,
    humanReviewStatus: humanReviewStage.status,
    run,
    candidate,
    review,
    duplicateProductionCandidates,
    actionRequiredReasons,
  });

  const trace = buildMarketingOperationsTrace({
    businessDateKst,
    run,
    candidate,
    review,
    performanceSnapshotIds: productionSnapshots.map((snapshot) => snapshot.snapshotId),
    researchSignalExternalIds: productionPerfSignals
      .map((signal) => signal.externalId)
      .filter((id): id is string => Boolean(id)),
  });

  const incident = buildMarketingIncidentTriage(run, candidate);
  if (incident && run?.status === "failed" && incident.recoveryDisposition === "human_action_required") {
    actionRequiredReasons.push(incident.recommendedOperatorAction);
  } else if (incident && run?.status === "failed" && incident.incidentClass === "business_rule_block") {
    actionRequiredReasons.push(incident.recommendedOperatorAction);
  }

  return {
    contract: DAILY_MARKETING_OPERATING_CYCLE_CONTRACT,
    businessDateKst,
    research: {
      status: researchStage.status,
      signalCount: researchContext.observability.candidateCount,
      briefCount: researchContext.briefs.length,
      degradedSources: researchStage.degradedSources,
      message: researchStage.message,
    },
    performanceBrief: {
      status: performanceStage.status,
      snapshotCount: productionSnapshots.length,
      artifactGeneratedAt: performanceBrief?.generatedAt ?? null,
      degradedSources: performanceStage.degradedSources,
      message: performanceStage.message,
    },
    marketingRun: {
      runId: run?.runId ?? null,
      logicalRunKey,
      status: marketingRunStage.status,
      runStatus: run?.status ?? null,
      failureReason: run?.failureReason ?? null,
      message: marketingRunStage.message,
    },
    candidate: {
      candidateId: candidate?.candidateId ?? null,
      status: candidate?.status ?? null,
      governanceDecision: candidate?.governanceDecision?.decision ?? null,
      duplicateCount: duplicateProductionCandidates,
      message: candidateStage.message,
    },
    humanReview: {
      reviewId: review?.reviewId ?? null,
      status: review?.status ?? null,
      message: humanReviewStage.message,
    },
    feedback,
    overallStatus,
    actionRequiredReasons,
    observedAt,
    trace,
    incident,
  };
}

export async function getRecentDailyMarketingOperationsSummaries(
  days = 7,
  deps: GetDailyMarketingOperationsStatusDeps = {},
): Promise<MarketingOperationsSummary[]> {
  const now = deps.now ?? new Date();
  const summaries: MarketingOperationsSummary[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    const businessDateKst = formatKstBusinessDate(date);
    const status = await getDailyMarketingOperationsStatus({ businessDateKst, now }, deps);
    summaries.push({
      businessDateKst: status.businessDateKst,
      overallStatus: status.overallStatus,
      marketingRunStatus: status.marketingRun.runStatus,
      candidateStatus: status.candidate.status,
      humanReviewStatus: status.humanReview.status,
      failureReason: status.marketingRun.failureReason,
      actionRequiredReasons: status.actionRequiredReasons,
    });
  }

  return summaries;
}

export function sanitizeOperationsDtoForResponse<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (typeof current === "string") {
        if (/api[_-]?key|secret|token|password|authorization/i.test(current) && current.length > 12) {
          return "[redacted]";
        }
      }
      return current;
    }),
  ) as T;
}

export { performanceSnapshotExternalId };
