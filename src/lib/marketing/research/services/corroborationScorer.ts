import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export type CorroborationAssessment = {
  score: number;
  sourceDiversityCount: number;
  independentSourceCount: number;
  reasons: string[];
};

function sourceFamilyKey(source: ResearchSource | undefined): string {
  if (!source) return "unknown";
  return `${source.provider ?? source.name}:${source.sourceType}`;
}

export function scoreCorroboration(input: {
  clusterSignals: ResearchSignal[];
  sources: Map<string, ResearchSource>;
}): CorroborationAssessment {
  const reasons: string[] = [];
  const sourceIds = new Set(input.clusterSignals.map((s) => s.sourceId));
  const families = new Set<string>();

  for (const signal of input.clusterSignals) {
    families.add(sourceFamilyKey(input.sources.get(signal.sourceId)));
  }

  const sourceDiversityCount = sourceIds.size;
  const independentSourceCount = families.size;

  let score = 0.35;
  if (sourceDiversityCount >= 2) {
    score += 0.2;
    reasons.push("multi_source_observation");
  }
  if (independentSourceCount >= 2) {
    score += 0.15;
    reasons.push("independent_source_families");
  }

  const hasOfficial = [...input.clusterSignals].some((signal) => {
    const source = input.sources.get(signal.sourceId);
    return source?.isOfficial || source?.sourceType === "official_government";
  });
  const hasNews = [...input.clusterSignals].some((signal) => {
    const source = input.sources.get(signal.sourceId);
    return source?.sourceType === "news";
  });
  if (hasOfficial && hasNews) {
    score += 0.2;
    reasons.push("official_plus_news_corroboration");
  }

  if (sourceDiversityCount >= 3 && independentSourceCount <= 1) {
    score -= 0.15;
    reasons.push("syndicated_source_family_penalty");
  }

  score = Math.max(0, Math.min(1, score));
  return { score, sourceDiversityCount, independentSourceCount, reasons };
}
