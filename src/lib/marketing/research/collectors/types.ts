import type { ResearchSourceType } from "@/lib/marketing/research/types/enums";
import type { CreateResearchEvidenceInput } from "@/lib/marketing/research/types/researchSignal";
import type { PerformanceFeedbackLoadResult } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";

/** Raw item from an external collector before domain normalization. */
export type RawResearchItem = {
  externalId?: string | null;
  title: string;
  summary?: string | null;
  body?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  observedAt: string;
  locale?: string | null;
  language?: string | null;
  destinationHints?: string[];
  topicHints?: string[];
  evidence: CreateResearchEvidenceInput[];
  metadata?: Record<string, unknown> | null;
};

export type CollectorContext = {
  sourceId: string;
  sourceType: ResearchSourceType;
  now: Date;
  maxItems?: number;
};

export type ResearchCollector = {
  collectorId: string;
  /** Registered research source id; the cycle rejects collectors without a registry match. */
  sourceId: string;
  sourceType: ResearchSourceType;
  collect(context: CollectorContext): Promise<RawResearchItem[]>;
};

export type CollectorRunStatus = "success" | "partial" | "failed" | "skipped";

export type CollectorRunResult = {
  collectorId: string;
  /** Null only for a `collector_identity_missing` failure. */
  sourceId: string | null;
  startedAt: string;
  completedAt: string;
  status: CollectorRunStatus;
  itemsObserved: number;
  itemsAccepted: number;
  itemsRejected: number;
  duplicates: number;
  errors: Array<{ code: string; message: string }>;
};

export type CollectionCycleStatus = "success" | "partial_success" | "failed" | "disabled";

export type ResearchCollectionCycleResult = {
  cycleId: string;
  startedAt: string;
  completedAt: string;
  status: CollectionCycleStatus;
  collectorResults: CollectorRunResult[];
  pipeline?: import("@/lib/marketing/research/services/pipeline").ResearchPipelineResult;
  totals: {
    rawItems: number;
    accepted: number;
    rejected: number;
    duplicates: number;
    briefs: number;
    agendaCandidates: number;
    performanceSnapshots?: number;
    performanceFeedbackStatus?: PerformanceFeedbackLoadResult["status"];
  };
};
