/**
 * Card Copy Worker surgical fix regressions (A–M).
 */

import { describe, expect, it } from "vitest";

import {
  CARD_COPY_NATURAL_KOREAN_CONTRACT_EN,
  CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
} from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  buildInstagramCardCopyWriterPayload,
  buildInstagramCardCopyWriterUserPrompt,
  INSTAGRAM_CARD_COPY_MOBILE_DENSITY,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import { INSTAGRAM_CARD_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type { InstagramCarouselPlan } from "@/lib/marketing/publishable/instagramEditorial/contracts";

const narrative = {
  contract: "editorial-narrative-plan-v1",
  assetId: "cma_x",
  assetVersion: 1,
  editorialArchetype: "discovery",
  narrativePromise: "지역별 차이를 비교하는 기준을 제공한다",
  audienceTakeaway: "비교 관점을 가질 수 있다",
  beats: [
    { beatId: "beat_01", purpose: "hook", message: "익숙한 해변" },
    { beatId: "beat_06", purpose: "payoff", message: "비교할 수 있는 기준을 얻게 된다" },
  ],
  sourceCanonicalFingerprint: "fp",
  provenance: {
    sourceAssetId: "cma_x",
    sourceVersion: 1,
    modelProfile: "editorial-narrative-planner",
    generatedAt: "2026-09-26T00:00:00.000Z",
  },
} as EditorialNarrativePlan;

const carousel = {
  contract: "instagram-carousel-plan-v1",
  assetId: "cma_x",
  assetVersion: 1,
  cards: [
    {
      cardId: "card-01",
      role: "hook_cover",
      beatIds: ["beat_01"],
      communicationGoal: "익숙한 해변 환기",
      visualPriority: "hero",
    },
    {
      cardId: "card-05",
      role: "closing",
      beatIds: ["beat_06"],
      communicationGoal: "향후 일정 기획 시 비교 기준 확보",
      visualPriority: "optional",
    },
  ],
  sourceNarrativeFingerprint: "fp_n",
  provenance: {
    sourceAssetId: "cma_x",
    sourceVersion: 1,
    modelProfile: "instagram-carousel-planner",
    generatedAt: "2026-09-26T00:00:00.000Z",
  },
} as InstagramCarouselPlan;

function payload() {
  return buildInstagramCardCopyWriterPayload({
    narrative,
    carousel,
    canonicalAsset: {
      assetId: "cma_x",
      titleKo: "t",
      openingHookKo: "hook",
      bodyKo: "body",
      keyTakeawaysKo: [],
      supportedClaimBoundaryKo: "boundary",
      forbiddenClaimsKo: [],
    },
  });
}

describe("card copy surgical fix regressions", () => {
  it("A. no repeated negative lexical seed inventory in SOUL-facing contract", () => {
    const seedPatterns = [
      /Weak:\s*"[^"]*프레임/,
      /Weak:\s*"[^"]*리듬/,
      /Weak:\s*"[^"]*맥락/,
      /Weak:\s*"[^"]*읽어내/,
      /Weak:\s*"[^"]*생활 리듬/,
      /Weak:\s*"[^"]*휴양 프레임/,
      /Families such as: 프레임 \/ 리듬/,
      /Overused editorial verbs to reconsider: 읽어내다/,
    ];
    for (const re of seedPatterns) {
      expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).not.toMatch(re);
      expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(re);
    }
  });

  it("B. positive concrete guidance remains", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/다른 주거 방식과 생활 모습/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/풍경과 분위기부터 달라집니다/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/해변과 리조트 밖에서 만나는/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/CONCRETE-BEFORE-ABSTRACT/);
  });

  it("C. closing may end on place/building/documented difference", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /place, person, building, documented difference, or limitation/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/A concrete ending is sufficient/i);
  });

  it("D. closing does not need criteria/perspective/insight synthesis", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Do not convert upstream takeaway[\s\S]*criteria, perspective, insight/i,
    );
    expect(CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE).toMatch(
      /do not echo planner nouns like criteria, perspective, insight/i,
    );
  });

  it("E. abstract-change payoff discouraged", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Do not invent abstract change\/payoff statements/i,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /when concrete evidence already carries the point/i,
    );
  });

  it("F. upstream communicationGoal still supplied", () => {
    const p = payload();
    const cards = p.cards as Array<{ communicationGoal: string; role: string }>;
    expect(cards.some((c) => c.communicationGoal.includes("비교 기준"))).toBe(true);
    expect(cards.find((c) => c.role === "closing")?.communicationGoal).toBeTruthy();
  });

  it("G. planner semantic meaning preserved without lexical-echo requirement", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/SEMANTIC INTENT ONLY \/ NOT SURFACE WORDING/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/not lexical form/i);
    const user = buildInstagramCardCopyWriterUserPrompt(payload());
    expect(user).toMatch(/DO NOT COPY PHRASING/);
  });

  it("H. mobile density unchanged", () => {
    expect(INSTAGRAM_CARD_COPY_MOBILE_DENSITY.defaultBodyLines.softTargetMax).toBe(4);
    expect(INSTAGRAM_CARD_COPY_MOBILE_DENSITY.closingBodyLines.preferredMax).toBe(4);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/~3–4 mobile lines/);
  });

  it("I. evidence safety unchanged", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Naturalization must NOT strengthen/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/supportedClaimBoundary/);
  });

  it("J. no forced CTA unchanged", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/No forced CTA/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/closing is \*\*not\*\* CTA by default/i);
  });

  it("K. no deterministic replacement", () => {
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).toMatch(/NOT a blacklist|Do NOT apply deterministic substitution/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/blacklist \/ regex \/ synonym-map/i);
  });

  it("L. truncated naturalKoreanContractSummary removed", () => {
    const p = payload();
    expect(p).not.toHaveProperty("naturalKoreanContractSummary");
    expect(JSON.stringify(p)).not.toMatch(/naturalKoreanContractSummary/);
  });

  it("M. semanticRegistry parity", () => {
    const entry = requireMarketingAgentSemanticContract("instagram-card-copy-writer");
    expect(entry.inputs.required).toEqual(
      expect.arrayContaining([
        "instagram.carouselStructure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    expect(entry.inputs.optional ?? []).not.toContain("canonical.factualBoundary");
    expect(entry.docs?.notes?.join("\n") ?? "").toMatch(/Closing payoff: concrete/i);
  });
});
