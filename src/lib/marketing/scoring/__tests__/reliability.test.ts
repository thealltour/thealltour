import { describe, expect, it } from "vitest";
import { SOURCE_RELIABILITY } from "@/lib/marketing/scoring/constants";
import { scoreReliability } from "@/lib/marketing/scoring/scoreReliability";
import { candidate, customerInsights, memory, product } from "./fixtures";

describe("reliability scoring", () => {
  it("uses source-type base scores", () => {
    expect(scoreReliability(candidate("product", product()))).toBe(SOURCE_RELIABILITY.product);
    expect(scoreReliability(candidate("customerInsights", customerInsights()))).toBe(
      SOURCE_RELIABILITY.inquiry_insight,
    );
    expect(scoreReliability(candidate("memory", memory()))).toBeLessThan(SOURCE_RELIABILITY.product);
  });

  it("keeps inferred memory below operational sources", () => {
    const memoryScore = scoreReliability(
      candidate("memory", memory({ confidence: 1, importance: 1, sourceType: "inferred" })),
    );
    expect(memoryScore).toBeLessThanOrEqual(0.75);
    expect(memoryScore).toBeLessThan(SOURCE_RELIABILITY.product);
  });
});
