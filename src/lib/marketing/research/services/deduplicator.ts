import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export type DeduplicationResult = {
  primary: ResearchSignal;
  duplicates: ResearchSignal[];
};

function canonicalKey(signal: ResearchSignal): string | null {
  if (signal.canonicalUrl) return `url:${signal.canonicalUrl.trim().toLowerCase()}`;
  if (signal.externalId) return `ext:${signal.externalId.trim().toLowerCase()}`;
  return null;
}

/**
 * Level 1: exact URL / externalId
 * Level 2: normalizedFingerprint
 */
export function deduplicateSignals(signals: ResearchSignal[]): {
  unique: ResearchSignal[];
  duplicates: ResearchSignal[];
} {
  const byKey = new Map<string, ResearchSignal>();
  const unique: ResearchSignal[] = [];
  const duplicates: ResearchSignal[] = [];

  for (const signal of signals) {
    const urlKey = canonicalKey(signal);
    const fpKey = signal.normalizedFingerprint
      ? `fp:${signal.normalizedFingerprint}`
      : null;

    let primary: ResearchSignal | undefined;
    if (urlKey) primary = byKey.get(urlKey);
    if (!primary && fpKey) primary = byKey.get(fpKey);

    if (primary) {
      duplicates.push({
        ...signal,
        status: "duplicate",
        duplicateOfSignalId: primary.id,
        corroborationCount: 0,
        updatedAt: new Date().toISOString(),
      });
      primary = {
        ...primary,
        corroborationCount: (primary.corroborationCount ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      if (urlKey) byKey.set(urlKey, primary);
      if (fpKey) byKey.set(fpKey, primary);
      const idx = unique.findIndex((s) => s.id === primary!.id);
      if (idx >= 0) unique[idx] = primary;
      continue;
    }

    const enriched = { ...signal, corroborationCount: signal.corroborationCount ?? 0 };
    if (urlKey) byKey.set(urlKey, enriched);
    if (fpKey) byKey.set(fpKey, enriched);
    unique.push(enriched);
  }

  return { unique, duplicates };
}

/** Hook for future BGE-M3 semantic clustering — not implemented in STEP 3-1. */
export type SemanticDedupCandidate = {
  signalId: string;
  embeddingRef?: string | null;
};

export interface SemanticResearchDeduplicator {
  findSemanticDuplicates(_candidates: SemanticDedupCandidate[]): Promise<Map<string, string>>;
}
