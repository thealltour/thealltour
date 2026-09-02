import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";
import { createPerformanceSignalAdapter } from "@/lib/marketing/performance/research/performanceSignalAdapter";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { PERFORMANCE_MEMORY_SOURCE } from "@/lib/marketing/performance/constants";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";

export type PerformanceFeedbackLoadResult = {
  status: "ok" | "empty" | "degraded";
  signals: RawResearchSignalInput[];
  snapshotsLoaded: number;
  reason?: string | null;
};

export type LoadPerformanceFeedbackSignalsInput = {
  repo: ResearchRepository;
  performanceRepo: ContentPerformanceRepository;
  since: string;
  now?: Date;
};

async function ensurePerformanceSource(repo: ResearchRepository, now: Date): Promise<void> {
  const existing = await repo.getSourceById(PERFORMANCE_MEMORY_SOURCE.id);
  const timestamp = now.toISOString();
  await repo.upsertSource({
    ...PERFORMANCE_MEMORY_SOURCE,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
}

export async function loadPerformanceFeedbackSignals(
  input: LoadPerformanceFeedbackSignalsInput,
): Promise<PerformanceFeedbackLoadResult> {
  const now = input.now ?? new Date();
  try {
    await ensurePerformanceSource(input.repo, now);
    const adapter = createPerformanceSignalAdapter(input.performanceRepo);
    const signals = await adapter.loadNormalizedSignals({ since: input.since });
    if (signals.length === 0) {
      return { status: "empty", signals: [], snapshotsLoaded: 0 };
    }
    return { status: "ok", signals, snapshotsLoaded: signals.length };
  } catch (error) {
    return {
      status: "degraded",
      signals: [],
      snapshotsLoaded: 0,
      reason: error instanceof Error ? error.message : "performance_feedback_load_failed",
    };
  }
}
