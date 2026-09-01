import { randomUUID } from "node:crypto";

import {
  computeNormalizedFingerprint,
  computeRawFingerprint,
  normalizeStringList,
  normalizeTitle,
} from "@/lib/marketing/research/fingerprint";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type {
  RawResearchSignalInput,
  ResearchSignal,
} from "@/lib/marketing/research/types/researchSignal";

export type NormalizeSignalResult =
  | { ok: true; signal: ResearchSignal }
  | { ok: false; reason: string; signal?: Partial<ResearchSignal> };

function hasMinimalProvenance(signal: RawResearchSignalInput): boolean {
  if (!signal.evidence || signal.evidence.length === 0) return false;
  const hasSourceLink = signal.evidence.some(
    (e) => e.sourceId && (e.url || e.reference || e.excerpt),
  );
  return hasSourceLink || Boolean(signal.canonicalUrl || signal.externalId);
}

export function normalizeResearchSignal(
  input: RawResearchSignalInput,
  source: ResearchSource,
  now: Date = new Date(),
): NormalizeSignalResult {
  if (!source.isEnabled) {
    return { ok: false, reason: "source_disabled" };
  }
  if (!hasMinimalProvenance(input)) {
    return { ok: false, reason: "insufficient_provenance" };
  }

  const id = input.id ?? randomUUID();
  const observedAt = input.observedAt;
  const title = normalizeTitle(input.title);
  const destinations = normalizeStringList(input.destinations ?? []);
  const geography = normalizeStringList(input.geography ?? []);
  const topics = normalizeStringList(input.topics ?? []);
  const entities = normalizeStringList(input.entities ?? []);

  const rawFingerprint = computeRawFingerprint({
    sourceId: input.sourceId,
    title,
    claim: input.claim,
    canonicalUrl: input.canonicalUrl,
    externalId: input.externalId,
  });

  const normalizedFingerprint = computeNormalizedFingerprint({
    signalType: input.signalType,
    title,
    claim: input.claim,
    destinations,
    geography,
  });

  const timestamp = now.toISOString();
  const signal: ResearchSignal = {
    ...input,
    id,
    sourceType: source.sourceType,
    title,
    destinations,
    geography,
    topics,
    entities,
    rawFingerprint,
    normalizedFingerprint,
    status: "normalized",
    duplicateOfSignalId: null,
    corroborationCount: 0,
    freshness: null,
    credibility: null,
    travelRelevance: null,
    publicInterestScore: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { ok: true, signal };
}
