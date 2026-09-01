import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";

export type NoveltyAssessment = {
  score: number;
  penalty: number;
  reasons: string[];
};

function topicKey(brief: ResearchBrief): string {
  const dest = brief.destinations[0] ?? "none";
  const topic = brief.topics.find((t) => t !== "travel") ?? brief.topics[0] ?? "general";
  return `${dest}:${topic}`.toLowerCase();
}

/** Within-cycle topic repetition penalty (not long-term fatigue). */
export function scoreNovelty(input: {
  brief: ResearchBrief;
  priorBriefs: ResearchBrief[];
}): NoveltyAssessment {
  const key = topicKey(input.brief);
  const repeats = input.priorBriefs.filter((b) => topicKey(b) === key).length;
  const penalty = Math.min(0.45, repeats * 0.15);
  const score = Math.max(0.2, 1 - penalty);
  const reasons =
    repeats > 0
      ? [`within_cycle_topic_repeat_${repeats}`]
      : ["within_cycle_novel_topic"];
  return { score, penalty, reasons };
}

export function scoreHistoricalDuplication(novelty: NoveltyAssessment): number {
  return novelty.score;
}
