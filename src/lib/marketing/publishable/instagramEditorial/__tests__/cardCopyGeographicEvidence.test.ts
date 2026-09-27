/**
 * Instagram Card Copy — geographic evidence scope surgical fix regressions (A–M).
 */

import { describe, expect, it } from "vitest";

import {
  CARD_COPY_NATURAL_KOREAN_CONTRACT_EN,
} from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { INSTAGRAM_CARD_COPY_CONTRACT } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_CARD_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";

describe("instagram card copy geographic evidence surgical fix", () => {
  it("A. mixed named destinations are not automatically collapsed into a region", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /When Canonical supplies multiple named destinations or examples, do not infer a broader geographic category that Canonical does not state/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Do not collapse a mixed set of named places into a directional, regional, cultural, or market bucket/i,
    );
  });

  it('B. unsupported "southern" grouping is not required for compression', () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /named destinations → an invented "southern resorts" \/ "southern Vietnam" \/ "the south" style bucket/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /shorten the contrast without adding geography/i,
    );
  });

  it("C. Canonical-supported regional terms remain allowed (non-Dao overfitting guard)", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /If Canonical explicitly supports a geographic category, that category remains allowed/i,
    );
    // Instruction lock: a Canonical that states e.g. "베트남 남부" may still surface that label.
    const supportedRegionFixture = {
      supportedClaimBoundaryKo: "베트남 남부 해안 휴양지와 북부 산악 기록을 대비한다",
      bodyKo: "베트남 남부에는 해변 중심 여행지가 많다.",
    };
    expect(supportedRegionFixture.supportedClaimBoundaryKo).toMatch(/베트남 남부/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(
      /never use 남부|forbid 남부|ban 남부/i,
    );
  });

  it("D. supported named-place contrast remains valid", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /restate supported named destinations/i,
    );
  });

  it("E. functional categories supported by Canonical remain valid", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /familiar resort\/city imagery/i,
    );
  });

  it("F. rule applies to headline/body/kicker/microcopy", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /applies to headline, body, kicker, and microcopy alike/i,
    );
  });

  it("G. no deterministic geographic blacklist", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /not a deterministic ban on directional geography/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Do not apply regex\/synonym-map substitution for regional terms/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/not a word blacklist/i);
  });

  it("H. existing Natural Korean fixes remain", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN.slice(0, 40));
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Natural Korean consumer voice/i);
  });

  it("I. closing behavior remains", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /recover prior cards' concrete payoff \(place \/ person \/ building \/ documented difference \/ limitation\)/i,
    );
  });

  it("J. mobile density remains", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/~3–4 mobile lines/i);
  });

  it("K. Narrative/Carousel semantic meaning remains", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/SEMANTIC INTENT ONLY|semantic intent/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/not phrasing to preserve/i);
  });

  it("L. evidence authority unchanged", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Use ONLY Canonical \/ Narrative \/ Carousel-assigned evidence/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Compression must not change factual scope/i,
    );
  });

  it("M. artifact schema unchanged + registry note", () => {
    expect(INSTAGRAM_CARD_COPY_CONTRACT).toBe("instagram-card-copy-v1");
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/"headline": "string"/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/"kicker": "optional"/);
    const entry = requireMarketingAgentSemanticContract("instagram-card-copy-writer");
    const notes = entry.docs?.notes?.join("\n") ?? "";
    expect(notes).toMatch(/preserve Canonical geographic scope/i);
    expect(notes).toMatch(/Canonical-supported regional labels remain allowed/i);
  });
});
