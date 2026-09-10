import type { MarketingObsAnalyticsRange } from "@/lib/marketing/observability/viewer/analytics/range";
import type { SampledDuration, SampledRate } from "@/lib/marketing/observability/viewer/analytics/stats";

export type AnalyticsTraceInput = {
  traceId: string;
  traceType: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
};

export type AnalyticsSpanInput = {
  traceId: string;
  spanId: string;
  name: string;
  stage: string;
  kind: string;
  attempt: number;
  status: string;
  otelStatusCode: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
  errorClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type StageBottleneckRow = {
  stage: string;
  label: string;
  runCount: number;
  duration: SampledDuration;
  technicalErrorCount: number;
  technicalErrorRate: SampledRate;
  /** CS only */
  attempt1Count: number | null;
  attempt2Count: number | null;
  revisionRate: SampledRate | null;
  timeContributionPct: number | null;
};

export type TopCountRow = {
  key: string;
  count: number;
};

export type TopErrorRow = {
  errorClass: string;
  count: number;
  affectedStage: string | null;
  lastOccurrenceAt: string | null;
  sampleMessage: string | null;
};

export type MarketingObservabilityAnalyticsDto = {
  range: MarketingObsAnalyticsRange;
  startAt: string;
  endAt: string;
  /** Traces after fixture exclusion. */
  includedTraceCount: number;
  excludedFixtureTraceCount: number;
  /** RUNNING with zero spans — excluded from analytics denominators (generic). */
  excludedEmptyRunningTraceCount: number;
  overview: {
    totalRuns: number;
    completed: number;
    partial: number;
    failed: number;
    running: number;
    staleRunning: number;
    completionRate: SampledRate;
    technicalFailureRate: SampledRate;
    endToEndDuration: SampledDuration;
    revisionRate: SampledRate;
    firstPassCompleteness: SampledRate;
  };
  stages: StageBottleneckRow[];
  quality: {
    firstPassCompleteness: SampledRate;
    completenessPassRate: SampledRate;
    completenessRevisionRate: SampledRate;
    avgRequiredDestinations: number | null;
    avgCoveredDestinations: number | null;
    destinationCoverageRatio: SampledRate;
    missingDestinationIncidents: number;
    requiredOutputFailures: number;
    sourceReferenceFailures: number;
    destinationCoverageSampleSize: number;
  };
  revision: {
    runsWithRevision: number;
    revisionRate: SampledRate;
    completenessTriggered: number;
    governanceTriggered: number;
    csAttempt2Rate: SampledRate;
    revisionExhausted: number;
    topReasons: TopCountRow[];
  };
  evidence: {
    /** Runs where evidence.available attribute was present. */
    runsWithEvidenceMetrics: number;
    evidenceAvailableZero: number;
    evidenceAvailablePositive: number;
    avgAvailable: number | null;
    avgAllowed: number | null;
    /** coverage_ratio mean over spans that recorded it. */
    avgCoverageRatio: number | null;
    coverageRatioSampleSize: number;
    runsWithNoUsableEvidence: number;
    sourceReferenceMissingRate: SampledRate;
  };
  governance: {
    allow: number;
    review: number;
    block: number;
    distributionSampleSize: number;
    avgRiskScore: number | null;
    riskScoreSampleSize: number;
    technicalGaFailures: number;
  };
  reliability: {
    technicalFailureRate: SampledRate;
    staleRunning: number;
    topErrors: TopErrorRow[];
    recentIncidents: Array<{
      at: string;
      stage: string;
      errorClass: string;
      summary: string;
      traceId: string;
    }>;
  };
  runtimeUsage: {
    label: "observed_trace_token_usage";
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
    tokensPerCompletedRun: number | null;
    spansWithTokenUsage: number;
    note: string;
  };
  decisionSignals: {
    csRevisionRate: SampledRate;
    csMedianDurationMs: number | null;
    csTimeSharePct: number | null;
    completenessFailureRate: SampledRate;
    evidenceNoUsableRate: SampledRate;
    gaReviewRate: SampledRate;
    gaBlockRate: SampledRate;
  };
  channel: {
    available: boolean;
    breakdown: TopCountRow[];
    note: string;
  };
};
