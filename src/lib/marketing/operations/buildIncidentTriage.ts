import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import {
  classifyMarketingIncident,
  type MarketingIncidentAssessment,
  type MarketingIncidentClass,
  type RecoveryDisposition,
} from "@/lib/marketing/operations/incidentClassification";

export type MarketingIncidentTriage = {
  incidentClass: MarketingIncidentClass;
  recoveryDisposition: RecoveryDisposition;
  governanceDecision: string | null;
  concernSummary: string;
  revisionAttempted: boolean;
  revisionOutcome: string | null;
  recommendedOperatorAction: string;
  priorIncidentCount: number;
  correlationId: string | null;
  runId: string | null;
  failureReason: string | null;
  recovered: boolean;
};

type StoredIncident = Partial<MarketingIncidentAssessment> & {
  incidentClass?: MarketingIncidentClass;
  recoveryDisposition?: RecoveryDisposition;
  operatorAction?: string;
};

type IncidentHistoryEntry = {
  runId?: string;
  failureReason?: string | null;
  pipelineFailure?: { code?: string; message?: string } | null;
  revisionCount?: number;
  governanceReviewId?: string | null;
};

function readStoredIncident(run: DailyMarketingRun | null): StoredIncident | null {
  if (!run?.metadata?.incident || typeof run.metadata.incident !== "object") return null;
  return run.metadata.incident as StoredIncident;
}

function readPipelineFailure(run: DailyMarketingRun | null): { code?: string; message?: string } | null {
  if (!run?.metadata?.pipelineFailure || typeof run.metadata.pipelineFailure !== "object") return null;
  return run.metadata.pipelineFailure as { code?: string; message?: string };
}

function readIncidentHistory(run: DailyMarketingRun | null): IncidentHistoryEntry[] {
  if (!run || !Array.isArray(run.metadata.incidentHistory)) return [];
  return run.metadata.incidentHistory as IncidentHistoryEntry[];
}

function selectPrimaryHistoricalIncident(history: IncidentHistoryEntry[]): IncidentHistoryEntry | null {
  if (history.length === 0) return null;
  const withEvidence = history.find((entry) => entry.pipelineFailure?.message);
  return withEvidence ?? history[0] ?? null;
}

function assessFromHistoryEntry(entry: IncidentHistoryEntry): MarketingIncidentAssessment {
  return classifyMarketingIncident({
    failureReason: entry.failureReason ?? null,
    pipelineFailureCode: entry.pipelineFailure?.code ?? null,
    pipelineFailureMessage: entry.pipelineFailure?.message ?? null,
    revisionCount: entry.revisionCount ?? 0,
    governanceReviewId: entry.governanceReviewId ?? null,
  });
}

export function snapshotFailedRunForIncidentHistory(run: DailyMarketingRun): Record<string, unknown> {
  return {
    runId: run.runId,
    correlationId: run.correlationId,
    executionAttempt: run.executionAttempt,
    status: run.status,
    failureReason: run.failureReason,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    selectedAgendaId: run.selectedAgendaId,
    assignmentId: run.assignmentId,
    governanceReviewId: run.governanceReviewId,
    pipelineFailure: readPipelineFailure(run),
    incident: readStoredIncident(run),
    revisionCount: run.observability.revisionCount,
    preservedAt: new Date().toISOString(),
  };
}

export function buildMarketingIncidentTriage(
  run: DailyMarketingRun | null,
  candidate: CompletedMarketingCandidate | null,
): MarketingIncidentTriage | null {
  if (!run) return null;

  const incidentHistory = readIncidentHistory(run);
  const recovered = run.status === "completed" && Boolean(run.completedCandidateId);
  const primaryHistorical = selectPrimaryHistoricalIncident(incidentHistory);

  const stored = readStoredIncident(run);
  const pipelineFailure = readPipelineFailure(run);

  const sourceFailure = recovered && primaryHistorical ? primaryHistorical.pipelineFailure : pipelineFailure;
  const sourceFailureReason =
    recovered && primaryHistorical ? primaryHistorical.failureReason ?? null : run.failureReason;
  const sourceRevisionCount =
    recovered && primaryHistorical
      ? (primaryHistorical.revisionCount ?? 0)
      : run.observability.revisionCount;

  const assessment = classifyMarketingIncident({
    failureReason: sourceFailureReason,
    pipelineFailureCode: sourceFailure?.code ?? null,
    pipelineFailureMessage: sourceFailure?.message ?? null,
    governanceDecision:
      candidate?.governanceDecision?.decision ??
      (run.metadata.governanceDecision ? String(run.metadata.governanceDecision) : null),
    candidateStatus: recovered ? null : candidate?.status ?? null,
    revisionCount: sourceRevisionCount,
    governanceReviewId:
      recovered && primaryHistorical
        ? (primaryHistorical.governanceReviewId ?? null)
        : run.governanceReviewId,
  });

  const revisionAttempted = stored?.revisionAttempted ?? assessment.revisionAttempted;
  let revisionOutcome: string | null = null;
  if (revisionAttempted) {
    if (candidate?.status === "blocked") revisionOutcome = "still_blocked";
    else if (candidate?.status === "ready_for_human_review") revisionOutcome = "recovered_after_revision";
    else if (run.status === "failed") revisionOutcome = "failed_before_second_pass";
    else revisionOutcome = "attempted";
  } else if (recovered && incidentHistory.length > 0) {
    revisionOutcome = "recovered_after_fix";
  }

  let concernSummary = stored?.concernSummary ?? assessment.concernSummary;
  if (recovered && incidentHistory.length > 0) {
    concernSummary = `${concernSummary} Controlled recovery succeeded; candidate is ${candidate?.status ?? "present"}.`;
  }

  return {
    incidentClass: stored?.incidentClass ?? assessment.incidentClass,
    recoveryDisposition: recovered ? "no_retry" : (stored?.recoveryDisposition ?? assessment.recoveryDisposition),
    governanceDecision:
      candidate?.governanceDecision?.decision ??
      (run.metadata.governanceDecision ? String(run.metadata.governanceDecision) : null),
    concernSummary,
    revisionAttempted,
    revisionOutcome,
    recommendedOperatorAction: recovered
      ? "Incident recovered. Proceed with Human Review; do not rerun unless a new defect is found."
      : (stored?.operatorAction ?? assessment.operatorAction),
    priorIncidentCount: incidentHistory.length,
    correlationId: run.correlationId,
    runId: run.runId,
    failureReason: sourceFailureReason,
    recovered,
  };
}
