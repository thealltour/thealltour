import { MARKETING_ATTR } from "@/lib/marketing/observability/attributes";
import { attributesIndicateFixture } from "@/lib/marketing/observability/viewer/analytics/fixture";
import type { MarketingObsAnalyticsRange } from "@/lib/marketing/observability/viewer/analytics/range";
import { sampledDuration, sampledRate } from "@/lib/marketing/observability/viewer/analytics/stats";
import type {
  AnalyticsSpanInput,
  AnalyticsTraceInput,
  MarketingObservabilityAnalyticsDto,
  StageBottleneckRow,
  TopCountRow,
  TopErrorRow,
} from "@/lib/marketing/observability/viewer/analytics/types";
import { DEFAULT_STALE_RUNNING_MS } from "@/lib/marketing/observability/viewer/live/staleRunning";

/** Stage rows for bottleneck table (excludes orchestration root to avoid double-count). */
export const ANALYTICS_BOTTLENECK_STAGES = [
  { stage: "marketing_manager", label: "Marketing Manager" },
  { stage: "deliverable_requirements", label: "Deliverable Requirements" },
  { stage: "evidence_pack", label: "Evidence Pack Builder" },
  { stage: "content_strategist", label: "Content Strategist" },
  { stage: "completeness_validator", label: "Completeness Validator" },
  { stage: "governance_auditor", label: "Governance Auditor" },
  { stage: "human_review", label: "Human Review Boundary" },
] as const;

const BOTTLENECK_STAGE_SET = new Set(ANALYTICS_BOTTLENECK_STAGES.map((s) => s.stage));

function attrString(attrs: Record<string, unknown>, key: string): string | null {
  const v = attrs[key];
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function attrNumber(attrs: Record<string, unknown>, key: string): number | null {
  const v = attrs[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function attrStringArray(attrs: Record<string, unknown>, key: string): string[] | null {
  const v = attrs[key];
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x));
}

function hasAttr(attrs: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(attrs, key);
}

function isTechnicalSpanFailure(span: AnalyticsSpanInput): boolean {
  return span.otelStatusCode === "ERROR" || span.status === "error";
}

function isTerminalTrace(status: string): boolean {
  return status === "completed" || status === "failed" || status === "partial";
}

function spanDurationMs(span: AnalyticsSpanInput): number | null {
  if (typeof span.durationMs === "number" && Number.isFinite(span.durationMs)) return span.durationMs;
  if (span.endedAt) {
    const a = Date.parse(span.startedAt);
    const b = Date.parse(span.endedAt);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(0, b - a);
  }
  return null;
}

function traceDurationMs(trace: AnalyticsTraceInput, nowMs: number): number | null {
  if (typeof trace.durationMs === "number" && Number.isFinite(trace.durationMs)) return trace.durationMs;
  if (trace.endedAt) {
    const a = Date.parse(trace.startedAt);
    const b = Date.parse(trace.endedAt);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(0, b - a);
  }
  if (trace.status === "running") {
    const a = Date.parse(trace.startedAt);
    if (Number.isFinite(a)) return Math.max(0, nowMs - a);
  }
  return null;
}

function isStaleRunning(trace: AnalyticsTraceInput, nowMs: number, thresholdMs: number): boolean {
  if (trace.status !== "running" || trace.endedAt) return false;
  const start = Date.parse(trace.startedAt);
  if (!Number.isFinite(start)) return false;
  return nowMs - start >= thresholdMs;
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/**
 * Pure aggregation — unit-tested. Does not touch DB.
 * Fixture traces are excluded from production analytics denominators.
 */
export function aggregateMarketingObservabilityAnalytics(input: {
  range: MarketingObsAnalyticsRange;
  startAt: string;
  endAt: string;
  traces: AnalyticsTraceInput[];
  spans: AnalyticsSpanInput[];
  nowMs?: number;
  staleThresholdMs?: number;
}): MarketingObservabilityAnalyticsDto {
  const nowMs = input.nowMs ?? Date.now();
  const staleThreshold = input.staleThresholdMs ?? DEFAULT_STALE_RUNNING_MS;

  const spansByTrace = new Map<string, AnalyticsSpanInput[]>();
  for (const span of input.spans) {
    const list = spansByTrace.get(span.traceId) ?? [];
    list.push(span);
    spansByTrace.set(span.traceId, list);
  }

  let excludedFixtureTraceCount = 0;
  const productionTraces: AnalyticsTraceInput[] = [];
  for (const trace of input.traces) {
    const spans = spansByTrace.get(trace.traceId) ?? [];
    const fixture =
      attributesIndicateFixture(trace.attributes) ||
      spans.some((s) => attributesIndicateFixture(s.attributes));
    if (fixture) {
      excludedFixtureTraceCount += 1;
      continue;
    }
    productionTraces.push(trace);
  }

  const productionIds = new Set(productionTraces.map((t) => t.traceId));
  const productionSpans = input.spans.filter((s) => productionIds.has(s.traceId));

  // Overview
  let completed = 0;
  let partial = 0;
  let failed = 0;
  let running = 0;
  let staleRunning = 0;
  const e2eDurations: number[] = [];
  let technicalFailedTerminal = 0;
  let terminalCount = 0;

  for (const t of productionTraces) {
    if (t.status === "completed") completed += 1;
    else if (t.status === "partial") partial += 1;
    else if (t.status === "failed") failed += 1;
    else if (t.status === "running") {
      running += 1;
      if (isStaleRunning(t, nowMs, staleThreshold)) staleRunning += 1;
    }

    if (isTerminalTrace(t.status)) {
      terminalCount += 1;
      const spans = spansByTrace.get(t.traceId) ?? [];
      const tech =
        t.status === "failed" || spans.some((s) => isTechnicalSpanFailure(s));
      if (tech) technicalFailedTerminal += 1;
      const dur = traceDurationMs(t, nowMs);
      if (dur != null && t.status !== "running") e2eDurations.push(dur);
    }
  }

  // Completeness / revision / CS
  let completenessRuns = 0;
  let firstPassOk = 0;
  let completenessPassRuns = 0;
  let completenessRevisionRuns = 0;
  let sumRequiredDest = 0;
  let sumCoveredDest = 0;
  let destCoveragePairs = 0;
  let missingDestIncidents = 0;
  let requiredOutputFailures = 0;
  let sourceReferenceFailures = 0;

  let runsWithRevision = 0;
  let completenessTriggered = 0;
  let governanceTriggered = 0;
  let csAttempt2Runs = 0;
  let csRuns = 0;
  let revisionExhausted = 0;
  const revisionReasons = new Map<string, number>();

  let evidenceMetricRuns = 0;
  let evidenceAvailableZero = 0;
  let evidenceAvailablePositive = 0;
  let sumEvidenceAvailable = 0;
  let sumEvidenceAllowed = 0;
  let evidenceAvailSamples = 0;
  let sumCoverageRatio = 0;
  let coverageRatioSamples = 0;
  let runsNoUsableEvidence = 0;
  let sourceRefMissingNum = 0;
  let sourceRefMissingDen = 0;

  let gaAllow = 0;
  let gaReview = 0;
  let gaBlock = 0;
  let gaDecisionRuns = 0;
  let sumRisk = 0;
  let riskSamples = 0;
  let technicalGaFailures = 0;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let tokenSpans = 0;
  let tokenOnCompleted = 0;
  let completedWithTokens = 0;

  const channelCounts = new Map<string, number>();
  let channelAttrPresent = false;

  const errorClassCounts = new Map<
    string,
    { count: number; stage: string; lastAt: string; message: string | null }
  >();
  const recentIncidents: MarketingObservabilityAnalyticsDto["reliability"]["recentIncidents"] = [];

  for (const trace of productionTraces) {
    const spans = spansByTrace.get(trace.traceId) ?? [];
    const completeness = spans.filter((s) => s.stage === "completeness_validator");
    const cs = spans.filter((s) => s.stage === "content_strategist");
    const evidence = spans.filter((s) => s.stage === "evidence_pack");
    const ga = spans.filter((s) => s.stage === "governance_auditor");

    const channel =
      attrString(trace.attributes, MARKETING_ATTR.CHANNEL) ??
      spans.map((s) => attrString(s.attributes, MARKETING_ATTR.CHANNEL)).find(Boolean) ??
      null;
    if (channel) {
      channelAttrPresent = true;
      increment(channelCounts, channel);
    }

    // Completeness first-pass
    if (completeness.length > 0) {
      completenessRuns += 1;
      const attempt1 = completeness.find((s) => s.attempt === 1) ?? completeness[0]!;
      const statusAttr = attrString(attempt1.attributes, MARKETING_ATTR.COMPLETENESS_STATUS);
      const firstPass =
        statusAttr === "pass" ||
        (attempt1.status === "ok" && statusAttr !== "fail");
      if (firstPass) firstPassOk += 1;

      const anyPass = completeness.some((s) => {
        const st = attrString(s.attributes, MARKETING_ATTR.COMPLETENESS_STATUS);
        return st === "pass" || s.status === "ok";
      });
      if (anyPass) completenessPassRuns += 1;

      const anyRev = completeness.some(
        (s) => s.status === "revision_required" || attrString(s.attributes, MARKETING_ATTR.COMPLETENESS_STATUS) === "fail",
      );
      if (anyRev) completenessRevisionRuns += 1;

      for (const s of completeness) {
        const required = attrStringArray(s.attributes, MARKETING_ATTR.REQ_DESTINATION_REQUIRED);
        const covered = attrStringArray(s.attributes, MARKETING_ATTR.REQ_DESTINATION_COVERED);
        if (required && covered) {
          sumRequiredDest += required.length;
          sumCoveredDest += covered.length;
          destCoveragePairs += 1;
        }
        const missing = attrStringArray(s.attributes, MARKETING_ATTR.REQ_DESTINATION_MISSING);
        if (missing && missing.length > 0) missingDestIncidents += 1;

        const codes = attrStringArray(s.attributes, MARKETING_ATTR.COMPLETENESS_FAILURE_CODES) ?? [];
        for (const code of codes) {
          const lower = code.toLowerCase();
          if (lower.includes("required_output") || lower.includes("missing_required_output")) {
            requiredOutputFailures += 1;
          }
          if (lower.includes("source_reference") || lower.includes("missing_source")) {
            sourceReferenceFailures += 1;
            sourceRefMissingNum += 1;
          }
          if (lower.includes("destination") || lower.includes("coverage")) {
            // counted via missingDestIncidents
          }
        }
        if (codes.length > 0) sourceRefMissingDen += 1;
      }
    }

    // Revision
    const hasCsAttempt2 = cs.some((s) => s.attempt >= 2);
    const hasCompletenessRev = completeness.some((s) => s.status === "revision_required");
    const hasRevisionRound = spans.some((s) => {
      const round = attrNumber(s.attributes, MARKETING_ATTR.REVISION_ROUND);
      return round != null && round >= 1;
    });
    const hasGaBlockRev = ga.some((s) => {
      const decision = attrString(s.attributes, MARKETING_ATTR.GOVERNANCE_DECISION);
      return decision === "BLOCK" && s.status === "blocked";
    });

    if (cs.length > 0) csRuns += 1;
    if (hasCsAttempt2) csAttempt2Runs += 1;

    const revised = hasCsAttempt2 || hasCompletenessRev || hasRevisionRound || hasGaBlockRev;
    if (revised) {
      runsWithRevision += 1;
      if (hasCompletenessRev || completeness.some((s) => attrString(s.attributes, MARKETING_ATTR.COMPLETENESS_STATUS) === "fail")) {
        completenessTriggered += 1;
      }
      if (hasGaBlockRev || ga.some((s) => attrString(s.attributes, MARKETING_ATTR.GOVERNANCE_DECISION) === "BLOCK")) {
        governanceTriggered += 1;
      }
    }

    // Exhausted: MAX_AUTO_REVISION_ROUNDS=1 → CS attempt 2 still failed completeness or ended revision_required
    const maxAttempt = Math.max(0, ...cs.map((s) => s.attempt), ...completeness.map((s) => s.attempt));
    if (
      maxAttempt >= 2 &&
      completeness.some((s) => s.attempt >= 2 && (s.status === "revision_required" || attrString(s.attributes, MARKETING_ATTR.COMPLETENESS_STATUS) === "fail"))
    ) {
      revisionExhausted += 1;
    }

    for (const s of spans) {
      const reason = attrString(s.attributes, MARKETING_ATTR.REVISION_REASON);
      if (reason) increment(revisionReasons, reason);
      const codes = attrStringArray(s.attributes, MARKETING_ATTR.COMPLETENESS_FAILURE_CODES);
      if (codes) {
        for (const code of codes) increment(revisionReasons, code);
      }
    }

    // Evidence — distinguish missing attr vs zero
    if (evidence.length > 0) {
      let sawAvailable = false;
      let availableVal: number | null = null;
      let allowedVal: number | null = null;
      for (const s of evidence) {
        if (hasAttr(s.attributes, MARKETING_ATTR.EVIDENCE_AVAILABLE)) {
          sawAvailable = true;
          availableVal = attrNumber(s.attributes, MARKETING_ATTR.EVIDENCE_AVAILABLE);
        }
        if (hasAttr(s.attributes, MARKETING_ATTR.EVIDENCE_ALLOWED)) {
          allowedVal = attrNumber(s.attributes, MARKETING_ATTR.EVIDENCE_ALLOWED);
        }
        if (hasAttr(s.attributes, MARKETING_ATTR.EVIDENCE_COVERAGE_RATIO)) {
          const r = attrNumber(s.attributes, MARKETING_ATTR.EVIDENCE_COVERAGE_RATIO);
          if (r != null) {
            sumCoverageRatio += r;
            coverageRatioSamples += 1;
          }
        }
      }
      if (sawAvailable) {
        evidenceMetricRuns += 1;
        if (availableVal === 0) evidenceAvailableZero += 1;
        if (availableVal != null && availableVal > 0) evidenceAvailablePositive += 1;
        if (availableVal != null) {
          sumEvidenceAvailable += availableVal;
          evidenceAvailSamples += 1;
        }
        if (allowedVal != null) sumEvidenceAllowed += allowedVal;
        if (availableVal === 0 || (allowedVal != null && allowedVal === 0 && availableVal === 0)) {
          runsNoUsableEvidence += 1;
        }
      }
    }

    // Governance
    for (const s of ga) {
      if (isTechnicalSpanFailure(s)) technicalGaFailures += 1;
      const decision = attrString(s.attributes, MARKETING_ATTR.GOVERNANCE_DECISION);
      if (decision) {
        gaDecisionRuns += 1;
        if (decision === "ALLOW") gaAllow += 1;
        else if (decision === "REVIEW") gaReview += 1;
        else if (decision === "BLOCK") gaBlock += 1;
      }
      if (hasAttr(s.attributes, MARKETING_ATTR.GOVERNANCE_RISK_SCORE)) {
        const risk = attrNumber(s.attributes, MARKETING_ATTR.GOVERNANCE_RISK_SCORE);
        if (risk != null) {
          sumRisk += risk;
          riskSamples += 1;
        }
      }
    }

    // Tokens (observed on spans only)
    let runInput = 0;
    let runOutput = 0;
    let runHasToken = false;
    for (const s of spans) {
      const inn = attrNumber(s.attributes, MARKETING_ATTR.GEN_AI_INPUT_TOKENS);
      const out = attrNumber(s.attributes, MARKETING_ATTR.GEN_AI_OUTPUT_TOKENS);
      if (inn != null || out != null) {
        tokenSpans += 1;
        runHasToken = true;
        if (inn != null) {
          totalInputTokens += inn;
          runInput += inn;
        }
        if (out != null) {
          totalOutputTokens += out;
          runOutput += out;
        }
      }

      if (isTechnicalSpanFailure(s) && s.errorClass) {
        const prev = errorClassCounts.get(s.errorClass);
        const at = s.endedAt ?? s.startedAt;
        if (!prev || Date.parse(at) >= Date.parse(prev.lastAt)) {
          errorClassCounts.set(s.errorClass, {
            count: (prev?.count ?? 0) + 1,
            stage: s.stage,
            lastAt: at,
            message: s.errorMessage,
          });
        } else if (prev) {
          prev.count += 1;
        }
        recentIncidents.push({
          at,
          stage: s.stage,
          errorClass: s.errorClass,
          summary: (s.errorMessage ?? s.errorCode ?? s.errorClass).slice(0, 160),
          traceId: s.traceId,
        });
      }
    }
    if (runHasToken && trace.status === "completed") {
      completedWithTokens += 1;
      tokenOnCompleted += runInput + runOutput;
    }
  }

  // Stage bottlenecks — only ANALYTICS_BOTTLENECK_STAGES (no nested tool double-count)
  const stageSpans = productionSpans.filter((s) => BOTTLENECK_STAGE_SET.has(s.stage));
  const stageDurationSum = new Map<string, number>();
  let allStageDurationSum = 0;
  for (const s of stageSpans) {
    const d = spanDurationMs(s);
    if (d == null) continue;
    stageDurationSum.set(s.stage, (stageDurationSum.get(s.stage) ?? 0) + d);
    allStageDurationSum += d;
  }

  const stages: StageBottleneckRow[] = ANALYTICS_BOTTLENECK_STAGES.map(({ stage, label }) => {
    const spans = stageSpans.filter((s) => s.stage === stage);
    // run count = distinct traces
    const traceIds = new Set(spans.map((s) => s.traceId));
    const durations = spans.map(spanDurationMs).filter((d): d is number => d != null);
    const techErrors = spans.filter(isTechnicalSpanFailure).length;
    const contribution =
      allStageDurationSum > 0 ? ((stageDurationSum.get(stage) ?? 0) / allStageDurationSum) * 100 : null;

    let attempt1Count: number | null = null;
    let attempt2Count: number | null = null;
    let revisionRate = null as ReturnType<typeof sampledRate> | null;
    if (stage === "content_strategist") {
      attempt1Count = spans.filter((s) => s.attempt === 1).length;
      attempt2Count = spans.filter((s) => s.attempt >= 2).length;
      const runs = traceIds.size;
      const revRuns = new Set(spans.filter((s) => s.attempt >= 2).map((s) => s.traceId)).size;
      revisionRate = sampledRate(revRuns, runs);
    }

    return {
      stage,
      label,
      runCount: traceIds.size,
      duration: sampledDuration(durations),
      technicalErrorCount: techErrors,
      technicalErrorRate: sampledRate(techErrors, spans.length),
      attempt1Count,
      attempt2Count,
      revisionRate,
      timeContributionPct: contribution,
    };
  });

  const topReasons: TopCountRow[] = [...revisionReasons.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topErrors: TopErrorRow[] = [...errorClassCounts.entries()]
    .map(([errorClass, v]) => ({
      errorClass,
      count: v.count,
      affectedStage: v.stage,
      lastOccurrenceAt: v.lastAt,
      sampleMessage: v.message,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  recentIncidents.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const firstPassCompleteness = sampledRate(firstPassOk, completenessRuns);
  const revisionRate = sampledRate(runsWithRevision, productionTraces.length);
  const csStage = stages.find((s) => s.stage === "content_strategist");
  const gaReviewRate = sampledRate(gaReview, gaDecisionRuns);
  const gaBlockRate = sampledRate(gaBlock, gaDecisionRuns);

  const completenessFailureRate = sampledRate(completenessRevisionRuns, completenessRuns);
  const evidenceNoUsableRate = sampledRate(runsNoUsableEvidence, evidenceMetricRuns);

  // Source reference missing: among completeness spans that recorded failure codes
  const sourceReferenceMissingRate = sampledRate(sourceRefMissingNum, Math.max(sourceRefMissingDen, completenessRuns > 0 ? completenessRuns : 0));

  return {
    range: input.range,
    startAt: input.startAt,
    endAt: input.endAt,
    includedTraceCount: productionTraces.length,
    excludedFixtureTraceCount,
    overview: {
      totalRuns: productionTraces.length,
      completed,
      partial,
      failed,
      running,
      staleRunning,
      completionRate: sampledRate(completed, terminalCount),
      technicalFailureRate: sampledRate(technicalFailedTerminal, terminalCount),
      endToEndDuration: sampledDuration(e2eDurations),
      revisionRate,
      firstPassCompleteness,
    },
    stages,
    quality: {
      firstPassCompleteness,
      completenessPassRate: sampledRate(completenessPassRuns, completenessRuns),
      completenessRevisionRate: sampledRate(completenessRevisionRuns, completenessRuns),
      avgRequiredDestinations: destCoveragePairs > 0 ? sumRequiredDest / destCoveragePairs : null,
      avgCoveredDestinations: destCoveragePairs > 0 ? sumCoveredDest / destCoveragePairs : null,
      destinationCoverageRatio:
        destCoveragePairs > 0 && sumRequiredDest > 0
          ? sampledRate(sumCoveredDest, sumRequiredDest)
          : sampledRate(0, 0),
      missingDestinationIncidents: missingDestIncidents,
      requiredOutputFailures,
      sourceReferenceFailures,
      destinationCoverageSampleSize: destCoveragePairs,
    },
    revision: {
      runsWithRevision,
      revisionRate,
      completenessTriggered,
      governanceTriggered,
      csAttempt2Rate: sampledRate(csAttempt2Runs, csRuns),
      revisionExhausted,
      topReasons,
    },
    evidence: {
      runsWithEvidenceMetrics: evidenceMetricRuns,
      evidenceAvailableZero,
      evidenceAvailablePositive,
      avgAvailable: evidenceAvailSamples > 0 ? sumEvidenceAvailable / evidenceAvailSamples : null,
      avgAllowed: evidenceAvailSamples > 0 ? sumEvidenceAllowed / evidenceAvailSamples : null,
      avgCoverageRatio: coverageRatioSamples > 0 ? sumCoverageRatio / coverageRatioSamples : null,
      coverageRatioSampleSize: coverageRatioSamples,
      runsWithNoUsableEvidence: runsNoUsableEvidence,
      sourceReferenceMissingRate,
    },
    governance: {
      allow: gaAllow,
      review: gaReview,
      block: gaBlock,
      distributionSampleSize: gaDecisionRuns,
      avgRiskScore: riskSamples > 0 ? sumRisk / riskSamples : null,
      riskScoreSampleSize: riskSamples,
      technicalGaFailures,
    },
    reliability: {
      technicalFailureRate: sampledRate(technicalFailedTerminal, terminalCount),
      staleRunning,
      topErrors,
      recentIncidents: recentIncidents.slice(0, 20),
    },
    runtimeUsage: {
      label: "observed_trace_token_usage",
      totalInputTokens: tokenSpans > 0 ? totalInputTokens : null,
      totalOutputTokens: tokenSpans > 0 ? totalOutputTokens : null,
      tokensPerCompletedRun:
        completedWithTokens > 0 ? tokenOnCompleted / completedWithTokens : null,
      spansWithTokenUsage: tokenSpans,
      note:
        tokenSpans === 0
          ? "No gen_ai.usage.* attributes observed on spans in this window (not AI Runtime ledger)."
          : "Observed on MarketingSpan attributes only — may diverge from AI Runtime ledger.",
    },
    decisionSignals: {
      csRevisionRate: csStage?.revisionRate ?? sampledRate(0, 0),
      csMedianDurationMs: csStage?.duration.medianMs ?? null,
      csTimeSharePct: csStage?.timeContributionPct ?? null,
      completenessFailureRate,
      evidenceNoUsableRate,
      gaReviewRate,
      gaBlockRate,
    },
    channel: {
      available: channelAttrPresent,
      breakdown: [...channelCounts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      note: channelAttrPresent
        ? "Channel breakdown from marketing.channel when present."
        : "marketing.channel not stably present in this window — filter omitted.",
    },
  };
}
