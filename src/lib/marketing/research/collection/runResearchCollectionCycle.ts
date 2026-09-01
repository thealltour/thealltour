import { randomUUID } from "node:crypto";

import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import {
  MVP_RESEARCH_SOURCES,
  isCollectorEnabled,
  isResearchCollectionEnabled,
} from "@/lib/marketing/research/collectors/config";
import { mapRawResearchItemToSignalInput } from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
import {
  NYT_TRAVEL_COLLECTOR_ID,
  UK_GOV_TRAVEL_COLLECTOR_ID,
} from "@/lib/marketing/research/collectors";
import type {
  CollectorRunResult,
  ResearchCollectionCycleResult,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";
import { createDefaultResearchCollectors } from "@/lib/marketing/research/collectors";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import { ResearchHttpError } from "@/lib/marketing/research/collectors/httpClient";

const COLLECTOR_SOURCE_ID: Record<string, string> = {
  [UK_GOV_TRAVEL_COLLECTOR_ID]: MVP_RESEARCH_SOURCES[0]!.id,
  [NYT_TRAVEL_COLLECTOR_ID]: MVP_RESEARCH_SOURCES[1]!.id,
};

export type RunResearchCollectionCycleInput = {
  repo: ResearchRepository;
  collectors?: ResearchCollector[];
  now?: Date;
  maxItemsPerCollector?: number;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
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
  let rawItems: RawResearchSignalInput[] = [];
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
  await bootstrapResearchSources(input.repo, now);

  const collectors = input.collectors ?? createDefaultResearchCollectors();
  const collectorResults: CollectorRunResult[] = [];
  const allRawSignals: RawResearchSignalInput[] = [];

  for (const collector of collectors) {
    if (!isCollectorEnabled(collector.collectorId, env)) {
      collectorResults.push({
        collectorId: collector.collectorId,
        sourceId: COLLECTOR_SOURCE_ID[collector.collectorId] ?? "unknown",
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

    const sourceId = COLLECTOR_SOURCE_ID[collector.collectorId];
    if (!sourceId) continue;

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
    },
  };
}
