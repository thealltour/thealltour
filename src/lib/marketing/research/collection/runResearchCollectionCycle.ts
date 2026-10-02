import { randomUUID } from "node:crypto";

import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import {
  isCollectorEnabled,
  isResearchCollectionEnabled,
} from "@/lib/marketing/research/collectors/config";
import { mapRawResearchItemToSignalInput } from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
import {
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  projectResearchSource,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import type {
  CollectorRunResult,
  ResearchCollectionCycleResult,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";
import { createDefaultResearchCollectors } from "@/lib/marketing/research/collectors";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import {
  canCollectResearchSource,
  resolveSourceLifecycleStatus,
  SOURCE_LIFECYCLE_INACTIVE,
} from "@/lib/marketing/research/sourceLifecycle";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import { ResearchHttpError } from "@/lib/marketing/research/collectors/httpClient";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import type { PerformanceFeedbackLoadResult } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";

export const COLLECTOR_IDENTITY_MISSING = "collector_identity_missing";
export const COLLECTOR_SOURCE_UNREGISTERED = "collector_source_unregistered";

type CollectorIdentityCheck =
  | { ok: true; sourceId: string; definition: ResearchSourceDefinition }
  | { ok: false; sourceId: string | null; error: { code: string; message: string } };

/** Injected collectors bypass the registry factories, so their identity is checked at run time. */
function checkCollectorIdentity(
  collector: ResearchCollector,
  sources: readonly ResearchSourceDefinition[],
): CollectorIdentityCheck {
  const raw: unknown = collector.sourceId;
  const sourceId = typeof raw === "string" ? raw.trim() : "";
  if (!sourceId) {
    return {
      ok: false,
      sourceId: null,
      error: {
        code: COLLECTOR_IDENTITY_MISSING,
        message: `collector ${collector.collectorId} has no sourceId`,
      },
    };
  }
  const definition = sources.find((source) => source.id === sourceId);
  if (!definition) {
    return {
      ok: false,
      sourceId,
      error: {
        code: COLLECTOR_SOURCE_UNREGISTERED,
        message: `collector ${collector.collectorId} sourceId ${sourceId} is not in the research source registry`,
      },
    };
  }
  return { ok: true, sourceId, definition };
}

function lifecycleSkippedResult(
  input: { collectorId: string; source: ResearchSourceDefinition; now: Date },
): CollectorRunResult {
  const status = resolveSourceLifecycleStatus(input.source);
  return {
    collectorId: input.collectorId,
    sourceId: input.source.id,
    startedAt: input.now.toISOString(),
    completedAt: new Date().toISOString(),
    status: "skipped",
    itemsObserved: 0,
    itemsAccepted: 0,
    itemsRejected: 0,
    duplicates: 0,
    errors: [
      {
        code: SOURCE_LIFECYCLE_INACTIVE,
        message: `source ${input.source.id} lifecycle is ${status}; collection skipped`,
      },
    ],
  };
}

export type RunResearchCollectionCycleInput = {
  repo: ResearchRepository;
  collectors?: ResearchCollector[];
  performanceRepo?: ContentPerformanceRepository;
  performanceLookbackHours?: number;
  now?: Date;
  maxItemsPerCollector?: number;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Source catalog (identity + lifecycle authority); defaults to the registry. */
  sources?: readonly ResearchSourceDefinition[];
};

function logResearchEvent(event: Record<string, unknown>): void {
  console.info("[research-collection]", JSON.stringify(event));
}

async function runCollector(
  collector: ResearchCollector,
  input: {
    sourceId: string;
    now: Date;
    maxItems?: number;
  },
): Promise<{ result: CollectorRunResult; rawItems: RawResearchSignalInput[] }> {
  const startedAt = input.now.toISOString();
  const errors: CollectorRunResult["errors"] = [];
  const rawItems: RawResearchSignalInput[] = [];
  let itemsObserved = 0;
  let itemsAccepted = 0;
  let itemsRejected = 0;

  try {
    const observed = await collector.collect({
      sourceId: input.sourceId,
      sourceType: collector.sourceType,
      now: input.now,
      maxItems: input.maxItems,
    });
    itemsObserved = observed.length;

    for (const item of observed) {
      const mapped = mapRawResearchItemToSignalInput(item, {
        sourceId: input.sourceId,
        sourceType: collector.sourceType,
      });
      if (!mapped) {
        itemsRejected += 1;
        continue;
      }
      rawItems.push(mapped);
      itemsAccepted += 1;
    }
  } catch (error) {
    if (error instanceof ResearchHttpError) {
      errors.push({ code: error.code, message: error.message });
    } else {
      errors.push({
        code: "collector_failed",
        message: error instanceof Error ? error.message : "unknown collector failure",
      });
    }
  }

  const completedAt = new Date().toISOString();
  const status: CollectorRunResult["status"] =
    errors.length > 0
      ? itemsAccepted > 0
        ? "partial"
        : "failed"
      : "success";

  return {
    result: {
      collectorId: collector.collectorId,
      sourceId: input.sourceId,
      startedAt,
      completedAt,
      status,
      itemsObserved,
      itemsAccepted,
      itemsRejected,
      duplicates: 0,
      errors,
    },
    rawItems,
  };
}

export async function runResearchCollectionCycle(
  input: RunResearchCollectionCycleInput,
): Promise<ResearchCollectionCycleResult> {
  const env = input.env ?? process.env;
  const cycleId = randomUUID();
  const startedAt = (input.now ?? new Date()).toISOString();
  const now = input.now ?? new Date();

  if (!isResearchCollectionEnabled(env)) {
    return {
      cycleId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "disabled",
      collectorResults: [],
      totals: {
        rawItems: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        briefs: 0,
        agendaCandidates: 0,
      },
    };
  }

  logResearchEvent({ cycleId, phase: "bootstrap", startedAt });
  const sources = input.sources ?? RESEARCH_SOURCE_REGISTRY;
  await bootstrapResearchSources(input.repo, now, input.sources);

  const collectors = input.collectors ?? createDefaultResearchCollectors(undefined, sources);
  const collectorResults: CollectorRunResult[] = [];
  const allRawSignals: RawResearchSignalInput[] = [];
  let performanceFeedback: PerformanceFeedbackLoadResult = {
    status: "empty",
    signals: [],
    snapshotsLoaded: 0,
  };

  for (const collector of collectors) {
    const identity = checkCollectorIdentity(collector, sources);
    if (!identity.ok) {
      const failed: CollectorRunResult = {
        collectorId: collector.collectorId,
        sourceId: identity.sourceId,
        startedAt: now.toISOString(),
        completedAt: new Date().toISOString(),
        status: "failed",
        itemsObserved: 0,
        itemsAccepted: 0,
        itemsRejected: 0,
        duplicates: 0,
        errors: [identity.error],
      };
      collectorResults.push(failed);
      logResearchEvent({
        cycleId,
        collectorId: collector.collectorId,
        sourceId: identity.sourceId,
        status: failed.status,
        errors: failed.errors,
      });
      continue;
    }
    const { sourceId, definition } = identity;

    if (!canCollectResearchSource(definition)) {
      const skipped = lifecycleSkippedResult({ collectorId: collector.collectorId, source: definition, now });
      collectorResults.push(skipped);
      logResearchEvent({
        cycleId,
        collectorId: collector.collectorId,
        sourceId,
        status: skipped.status,
        errors: skipped.errors,
      });
      continue;
    }

    if (!isCollectorEnabled(collector.collectorId, env)) {
      collectorResults.push({
        collectorId: collector.collectorId,
        sourceId,
        startedAt: now.toISOString(),
        completedAt: new Date().toISOString(),
        status: "skipped",
        itemsObserved: 0,
        itemsAccepted: 0,
        itemsRejected: 0,
        duplicates: 0,
        errors: [],
      });
      continue;
    }

    const started = Date.now();
    const { result, rawItems } = await runCollector(collector, {
      sourceId,
      now,
      maxItems: input.maxItemsPerCollector ?? 25,
    });
    collectorResults.push(result);
    allRawSignals.push(...rawItems);

    logResearchEvent({
      cycleId,
      collectorId: collector.collectorId,
      sourceId,
      durationMs: Date.now() - started,
      observed: result.itemsObserved,
      accepted: result.itemsAccepted,
      rejected: result.itemsRejected,
      status: result.status,
      errors: result.errors,
    });
  }

  const lookbackHours = input.performanceLookbackHours ?? 24 * 14;
  const performanceSince = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString();
  const performanceSource =
    sources.find((source) => source.id === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id) ??
    PERFORMANCE_MEMORY_SOURCE_DEFINITION;
  if (input.performanceRepo && !canCollectResearchSource(performanceSource)) {
    const skipped = lifecycleSkippedResult({
      collectorId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.key,
      source: performanceSource,
      now,
    });
    collectorResults.push(skipped);
    logResearchEvent({ cycleId, phase: "performance_feedback", status: skipped.status, errors: skipped.errors });
  } else if (input.performanceRepo) {
    performanceFeedback = await loadPerformanceFeedbackSignals({
      repo: input.repo,
      performanceRepo: input.performanceRepo,
      since: performanceSince,
      now,
      ...(input.sources ? { source: projectResearchSource(performanceSource) } : {}),
    });
    if (performanceFeedback.signals.length > 0) {
      allRawSignals.push(...performanceFeedback.signals);
      collectorResults.push({
        collectorId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.key,
        sourceId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.id,
        startedAt: now.toISOString(),
        completedAt: new Date().toISOString(),
        status: performanceFeedback.status === "degraded" ? "partial" : "success",
        itemsObserved: performanceFeedback.snapshotsLoaded,
        itemsAccepted: performanceFeedback.signals.length,
        itemsRejected: 0,
        duplicates: 0,
        errors:
          performanceFeedback.status === "degraded" && performanceFeedback.reason
            ? [{ code: "performance_feedback_degraded", message: performanceFeedback.reason }]
            : [],
      });
    } else if (performanceFeedback.status === "degraded") {
      collectorResults.push({
        collectorId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.key,
        sourceId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.id,
        startedAt: now.toISOString(),
        completedAt: new Date().toISOString(),
        status: "partial",
        itemsObserved: 0,
        itemsAccepted: 0,
        itemsRejected: 0,
        duplicates: 0,
        errors: [{ code: "performance_feedback_degraded", message: performanceFeedback.reason ?? "unknown" }],
      });
    }

    logResearchEvent({
      cycleId,
      phase: "performance_feedback",
      status: performanceFeedback.status,
      snapshotsLoaded: performanceFeedback.snapshotsLoaded,
      signalsAccepted: performanceFeedback.signals.length,
      reason: performanceFeedback.reason ?? null,
    });
  }

  const pipeline = await runResearchPipeline({
    repo: input.repo,
    rawSignals: allRawSignals,
    now,
  });

  for (const result of collectorResults) {
    result.duplicates = pipeline.duplicates.length;
  }

  const successes = collectorResults.filter((r) => r.status === "success" || r.status === "partial");
  const failures = collectorResults.filter((r) => r.status === "failed");
  const status: ResearchCollectionCycleResult["status"] =
    successes.length === 0 && failures.length > 0
      ? "failed"
      : failures.length > 0
        ? "partial_success"
        : "success";

  const completedAt = new Date().toISOString();
  logResearchEvent({
    cycleId,
    phase: "complete",
    status,
    accepted: pipeline.normalized.length,
    rejected: pipeline.rejected.length,
    duplicates: pipeline.duplicates.length,
    briefs: pipeline.briefs.length,
    agendaCandidates: pipeline.agendaCandidates.length,
    completedAt,
  });

  return {
    cycleId,
    startedAt,
    completedAt,
    status,
    collectorResults,
    pipeline,
    totals: {
      rawItems: allRawSignals.length,
      accepted: pipeline.normalized.length,
      rejected: pipeline.rejected.length,
      duplicates: pipeline.duplicates.length,
      briefs: pipeline.briefs.length,
      agendaCandidates: pipeline.agendaCandidates.length,
      performanceSnapshots: performanceFeedback.snapshotsLoaded,
      performanceFeedbackStatus: input.performanceRepo ? performanceFeedback.status : undefined,
    },
  };
}
