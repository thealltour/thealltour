import { randomUUID } from "node:crypto";

import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type {
  CreateResearchEvidenceInput,
  RawResearchSignalInput,
  ResearchEvidence,
} from "@/lib/marketing/research/types/researchSignal";
import type { RawResearchItem } from "@/lib/marketing/research/collectors/types";

function resolveSignalType(item: RawResearchItem): ResearchSignalType {
  const hint = item.metadata?.signalTypeHint;
  if (typeof hint === "string") {
    return hint as ResearchSignalType;
  }
  return "general_travel_news";
}

function normalizeEvidence(
  evidence: CreateResearchEvidenceInput[],
  sourceId: string,
): ResearchEvidence[] {
  return evidence.map((row) => ({
    ...row,
    id: row.id ?? randomUUID(),
    sourceId: row.sourceId || sourceId,
    observedAt: row.observedAt,
  }));
}

export function mapRawResearchItemToSignalInput(
  item: RawResearchItem,
  input: {
    sourceId: string;
    sourceType: RawResearchSignalInput["sourceType"];
  },
): RawResearchSignalInput | null {
  const title = item.title?.trim();
  if (!title) return null;

  const summary = item.summary?.trim() || title;
  const evidence = normalizeEvidence(item.evidence ?? [], input.sourceId);
  if (evidence.length === 0 && !item.canonicalUrl && !item.externalId) {
    return null;
  }

  const claim =
    typeof item.metadata?.claimSource === "string" && item.metadata.claimSource === "source"
      ? summary
      : summary;

  return {
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    signalType: resolveSignalType(item),
    title,
    summary,
    claim,
    claimSource: "source",
    evidence,
    canonicalUrl: item.canonicalUrl ?? null,
    externalId: item.externalId ?? null,
    publishedAt: item.publishedAt ?? null,
    observedAt: item.observedAt,
    geography: [],
    destinations: item.destinationHints ?? [],
    topics: item.topicHints ?? ["travel"],
    entities: [],
    language: item.language ?? "en",
    metadata: item.metadata ?? null,
  };
}
