import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

const OFFICIAL_TYPES = new Set([
  "official_government",
  "tourism_board",
  "airline",
  "airport",
]);

function anchorMs(signal: ResearchSignal): number {
  const raw = signal.publishedAt ?? signal.observedAt;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

function provenanceRichness(signal: ResearchSignal): number {
  return signal.evidence.filter((e) => e.url || e.reference).length;
}

export function selectPrimarySignal(
  signals: ResearchSignal[],
  sources: Map<string, ResearchSource>,
): ResearchSignal {
  return [...signals].sort((a, b) => {
    const sourceA = sources.get(a.sourceId);
    const sourceB = sources.get(b.sourceId);
    const officialA =
      sourceA?.isOfficial || (sourceA && OFFICIAL_TYPES.has(sourceA.sourceType)) ? 1 : 0;
    const officialB =
      sourceB?.isOfficial || (sourceB && OFFICIAL_TYPES.has(sourceB.sourceType)) ? 1 : 0;
    if (officialA !== officialB) return officialB - officialA;

    const credDiff = (b.credibility?.score ?? 0) - (a.credibility?.score ?? 0);
    if (credDiff !== 0) return credDiff;

    const timeDiff = anchorMs(a) - anchorMs(b);
    if (timeDiff !== 0) return timeDiff;

    return provenanceRichness(b) - provenanceRichness(a);
  })[0]!;
}
