import type { StoryContentPoint, StoryMechanism } from "@/lib/marketing/storyPoint/contracts";
import { mechanismKey } from "@/lib/marketing/storyPoint/hash";

const STOPWORDS = new Set([
  "여행",
  "가기",
  "가기전",
  "전에",
  "확인",
  "확인할",
  "봐야",
  "볼",
  "살펴볼",
  "놓치면",
  "안될",
  "주의",
  "사항",
  "체크리스트",
  "준비",
  "가이드",
  "정보",
  "팁",
  "가지",
  "것들",
  "포인트",
  "방법",
  "추천",
  "총정리",
  "한눈에",
  "알아두면",
  "좋은",
  "필수",
  "꼭",
  "해야",
  "할",
  "것",
  "점",
  "시",
  "의",
  "를",
  "을",
  "이",
  "가",
  "은",
  "는",
  "와",
  "과",
  "에서",
  "으로",
  "로",
  "및",
  "등",
  "the",
  "a",
  "an",
  "to",
  "for",
  "of",
  "and",
  "in",
  "on",
]);

const CHECKLIST_SHAPE =
  /(체크리스트|살펴볼\s*점|주의\s*사항|준비\s*(팁|사항)|알아두면\s*좋은|놓치면\s*안\s*될|확인(할)?\s*\d+|봐야\s*할\s*\d+)/;

/** Normalize editorial hypothesis for deterministic paraphrase detection. */
export function normalizeStoryHypothesis(point: StoryContentPoint): string {
  const raw = [point.storyQuestion, point.storyClaim, point.curiosityGap]
    .filter(Boolean)
    .join(" ");
  return raw
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function storyHypothesisTokens(point: StoryContentPoint): Set<string> {
  const tokens = normalizeStoryHypothesis(point)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) {
    if (b.has(t)) hit += 1;
  }
  return hit / (a.size + b.size - hit);
}

export function isChecklistShape(point: StoryContentPoint): boolean {
  const blob = [point.storyQuestion, point.storyClaim, point.curiosityGap, point.readerPayoff]
    .filter(Boolean)
    .join(" ");
  return CHECKLIST_SHAPE.test(blob);
}

export function areEditorialParaphrases(a: StoryContentPoint, b: StoryContentPoint): boolean {
  const tokensA = storyHypothesisTokens(a);
  const tokensB = storyHypothesisTokens(b);
  const overlap = jaccardSimilarity(tokensA, tokensB);
  const sameMechanism =
    mechanismKey(a.mechanisms) === mechanismKey(b.mechanisms) && a.mechanisms.length > 0;
  const bothChecklist = isChecklistShape(a) && isChecklistShape(b);

  if (bothChecklist && overlap >= 0.35) return true;
  if (sameMechanism && overlap >= 0.55) return true;
  if (overlap >= 0.72) return true;

  const normA = normalizeStoryHypothesis(a);
  const normB = normalizeStoryHypothesis(b);
  if (normA.length >= 12 && normB.length >= 12) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  return false;
}

export type DiversityAssessment = {
  ok: boolean;
  clusterCount: number;
  paraphrasePairs: number;
  uniqueMechanisms: number;
  reasons: string[];
};

/**
 * Deterministic diversity check — no embeddings.
 * Rejects sets that are structural paraphrases of one editorial idea.
 */
export function assessCandidateDiversity(candidates: StoryContentPoint[]): DiversityAssessment {
  const reasons: string[] = [];
  if (candidates.length < 2) {
    return {
      ok: false,
      clusterCount: candidates.length,
      paraphrasePairs: 0,
      uniqueMechanisms: new Set(candidates.flatMap((c) => c.mechanisms)).size,
      reasons: ["too_few_candidates_for_diversity"],
    };
  }

  const parent = candidates.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  let paraphrasePairs = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (areEditorialParaphrases(candidates[i]!, candidates[j]!)) {
        paraphrasePairs += 1;
        union(i, j);
      }
    }
  }

  const clusters = new Set(candidates.map((_, i) => find(i)));
  const uniqueMechanisms = new Set(candidates.flatMap((c) => c.mechanisms)).size;
  const checklistHeavy = candidates.filter(isChecklistShape).length >= Math.ceil(candidates.length * 0.7);

  if (clusters.size < 3) {
    reasons.push("editorial_cluster_count_below_3");
  }
  if (uniqueMechanisms < 2 && candidates.length >= 5) {
    reasons.push("mechanism_variety_too_low");
  }
  if (checklistHeavy && clusters.size <= 2) {
    reasons.push("checklist_paraphrase_collapse");
  }
  if (paraphrasePairs >= candidates.length) {
    reasons.push("excessive_paraphrase_pairs");
  }

  return {
    ok: reasons.length === 0,
    clusterCount: clusters.size,
    paraphrasePairs,
    uniqueMechanisms,
    reasons,
  };
}

/** Prefer selecting points with distinct mechanisms when composites are close. */
export function diversityAdjustedScore(
  point: StoryContentPoint,
  composite: number,
  alreadySelectedMechanisms: Set<StoryMechanism>,
): number {
  let bonus = 0;
  const novel = point.mechanisms.filter((m) => !alreadySelectedMechanisms.has(m));
  if (novel.length > 0) bonus += 0.04;
  if (point.mechanisms.length >= 2) bonus += 0.01;
  if (isChecklistShape(point)) bonus -= 0.03;
  return composite + bonus;
}
