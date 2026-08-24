import { describe, expect, it } from "vitest";
import { SCORING_WEIGHTS } from "@/lib/marketing/scoring/constants";
import { weightsSumToOne } from "@/lib/marketing/scoring/clamp";
import { computeTotalScore } from "@/lib/marketing/scoring/scoreContext";
import { combineHybridScores } from "@/lib/marketing/scoring/hybridScore";

describe("total score", () => {
  it("uses weights that sum to 1", () => {
    expect(weightsSumToOne(SCORING_WEIGHTS)).toBe(true);
  });

  it("computes the weighted total", () => {
    const total = computeTotalScore({
      relevance: 1,
      freshness: 0,
      reliability: 0,
      businessImportance: 0,
    });
    expect(total).toBeCloseTo(SCORING_WEIGHTS.relevance);
  });

  it("clamps totals to 0..1", () => {
    expect(
      computeTotalScore(
        { relevance: 2, freshness: 2, reliability: 2, businessImportance: 2 },
        { relevance: 1, freshness: 1, reliability: 1, businessImportance: 1 },
      ),
    ).toBe(1);
    expect(computeTotalScore({ relevance: -1, freshness: -1, reliability: -1, businessImportance: -1 })).toBe(0);
  });

  it("keeps hybrid scoring available without applying it to ranking", () => {
    expect(combineHybridScores({ semanticScore: null, contextScore: 0.8 })).toBe(0.8);
    expect(combineHybridScores({ semanticScore: 1, contextScore: 0 })).toBeGreaterThan(0);
  });
});
