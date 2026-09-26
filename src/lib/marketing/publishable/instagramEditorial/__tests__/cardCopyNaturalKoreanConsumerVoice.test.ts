/**
 * Instagram Card Copy — Natural Korean Consumer Voice contract tests (A–M).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CARD_COPY_ABSTRACT_EDITORIAL_FAMILIES,
  CARD_COPY_NATURAL_KOREAN_CONTRACT_EN,
  CARD_COPY_SEMANTIC_REGISTRY_NOTES,
  CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
} from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";
import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  assembleInstagramMetaFromEditorial,
  assembleInstagramCardPlanFromEditorial,
} from "@/lib/marketing/publishable/instagramEditorial/assemblePublishable";
import {
  buildInstagramCardCopyWriterPayload,
  buildInstagramCardCopyWriterUserPrompt,
  INSTAGRAM_CARD_COPY_MOBILE_DENSITY,
  mobileDensityGuidanceForRole,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import type {
  InstagramCaption,
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_CARD_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  DAO_CARD_COPY_OLD_PROBLEM_PHRASES,
  DAO_CARD_COPY_OLD_SURFACE,
  DAO_CARD_COPY_NATURALIZED_FIXTURE,
  countProblemPhraseHits,
  scoreAbstractionCluster,
} from "@/lib/marketing/publishable/instagramEditorial/__tests__/fixtures/daoCardCopyNaturalKorean";

const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;

const narrative: EditorialNarrativePlan = {
  contract: "editorial-narrative-plan-v1",
  assetId: "cma_test",
  assetVersion: 1,
  narrativePromise: "휴양 프레임을 북부 국경 생활 모습으로 재구성한다",
  audienceTakeaway: "해변만 아는 독자에게 다른 주거·풍경을 보여준다",
  beats: [
    { beatId: "beat_01", purpose: "hook", message: "익숙한 해변 이미지를 소환" },
    { beatId: "beat_02", purpose: "reframe", message: "북부 국경으로 가면 풍경이 달라진다" },
    { beatId: "beat_03", purpose: "context", message: "랑선·Dao족 맥락" },
    { beatId: "beat_04", purpose: "evidence", message: "흙다짐 주택 디테일" },
    { beatId: "beat_05", purpose: "payoff", message: "휴양 프레임 밖 payoff" },
  ],
  sourceCanonicalFingerprint: "fp_canon",
  provenance: {
    sourceAssetId: "cma_test",
    sourceVersion: 1,
    modelProfile: "editorial-narrative-planner",
    generatedAt: "2026-09-26T00:00:00.000Z",
  },
};

const carousel: InstagramCarouselPlan = {
  contract: "instagram-carousel-plan-v1",
  assetId: "cma_test",
  assetVersion: 1,
  cards: [
    {
      cardId: "card-01",
      role: "hook_cover",
      beatIds: ["beat_01"],
      communicationGoal: "익숙한 베트남 해변 이미지 소환",
      visualPriority: "hero",
    },
    {
      cardId: "card-02",
      role: "reframe",
      beatIds: ["beat_02"],
      communicationGoal: "북쪽으로 가면 풍경이 달라진다는 새 정보",
      visualPriority: "strong",
    },
    {
      cardId: "card-03",
      role: "context",
      beatIds: ["beat_03"],
      communicationGoal: "랑선·Dao족 소개",
      visualPriority: "useful",
    },
    {
      cardId: "card-04",
      role: "evidence",
      beatIds: ["beat_04"],
      communicationGoal: "흙다짐 주택을 구체 증거로",
      visualPriority: "strong",
    },
    {
      cardId: "card-05",
      role: "closing",
      beatIds: ["beat_05"],
      communicationGoal: "스토리 payoff — 프레임이 바뀐다",
      visualPriority: "useful",
    },
  ],
  sourceNarrativeFingerprint: "fp_narr",
  provenance: {
    sourceAssetId: "cma_test",
    sourceVersion: 1,
    modelProfile: "instagram-carousel-planner",
    generatedAt: "2026-09-26T00:00:00.000Z",
    sourceUpstreamFingerprint: "fp_narr",
  },
};

function payload() {
  return buildInstagramCardCopyWriterPayload({
    narrative,
    carousel,
    canonicalAsset: {
      assetId: "cma_test",
      titleKo: "테스트",
      openingHookKo: "해변만 떠올렸다면",
      bodyKo: "북부 국경에는 다른 주거 방식이 있다.",
      keyTakeawaysKo: ["풍경이 다르다"],
      supportedClaimBoundaryKo: "공식 기록 범위",
      forbiddenClaimsKo: ["개인 경험 단정"],
    },
  });
}

describe("Card Copy Natural Korean Consumer Voice", () => {
  it("A: planner vocabulary boundary included in Card Copy prompt/SOUL", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain(U.title);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain(U.semanticNotPhrasing);
    const p = payload();
    expect(p.upstreamVocabularyBoundary).toMatchObject({
      semanticNotPhrasing: U.semanticNotPhrasing,
      rewriteMeaning: U.rewriteMeaning,
    });
    const user = buildInstagramCardCopyWriterUserPrompt(p);
    expect(user).toContain(U.semanticNotPhrasing);
    expect(user).toContain("SEMANTIC INTENT ONLY / NOT SURFACE WORDING");
  });

  it("B: upstream phrasing explicitly non-authoritative", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain(U.fieldsNotSeeds);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain(U.preserveMeaningNotForm);
    const p = payload();
    const cards = p.cards as Array<{
      communicationGoalAuthority: string;
      beatMessages: Array<{ wordingAuthority: string }>;
    }>;
    expect(cards.every((c) => c.communicationGoalAuthority === "semantic_intent_only")).toBe(true);
    expect(
      cards.every((c) => c.beatMessages.every((b) => b.wordingAuthority === "semantic_intent_only")),
    ).toBe(true);
    expect((p.editorialNarrativePlan as { narrativePromiseAuthority: string }).narrativePromiseAuthority).toBe(
      "semantic_intent_only",
    );
  });

  it("C: natural Korean consumer voice instruction", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toContain("NATURAL KOREAN CONSUMER VOICE");
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/everyday educated|travel\/editorial cardnews/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/planning memo|strategy deck|AI insight/i);
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).toMatch(/REWRITE meaning/i);
  });

  it("D: concrete-before-abstract rule", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/CONCRETE-BEFORE-ABSTRACT/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Prefer naming what differs/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Keep examples minimal/);
    // Strong negative phrase seeds intentionally reduced (lexical seed risk)
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(/문화적 맥락을 읽어내게 됩니다/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(/여행의 리듬이 달라집니다/);
  });

  it("E: noun-stack avoidance guidance", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/KOREAN NOUN-STACK/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/생활문화 기록/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/문화적 맥락/);
    // Do not re-seed the strongest Dao bad phrases in the inventory
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(/휴양 프레임 밖에서 읽는 생활 리듬/);
  });

  it("F: interpretive verb guidance", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/INTERPRETIVE VERBS/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/읽어내다/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/볼 수 있다/);
  });

  it("G: no blacklist/replacement implementation", () => {
    const root = process.cwd();
    const promptSrc = readFileSync(
      join(root, "src/lib/marketing/publishable/instagramEditorial/cardCopyPrompt.ts"),
      "utf8",
    );
    const contractSrc = readFileSync(
      join(root, "src/lib/marketing/agentContracts/cardCopyNaturalKoreanContract.ts"),
      "utf8",
    );
    for (const src of [promptSrc, contractSrc]) {
      expect(src).not.toMatch(/replaceAll\s*\(/);
      expect(src).not.toMatch(/new RegExp\(/);
      expect(src).not.toMatch(/synonymMap|replacementMap|blacklistReject/i);
    }
    expect(contractSrc).toMatch(/NOT a blacklist/i);
    expect(promptSrc).toMatch(/blacklist or synonym-map substitution/);
    expect(CARD_COPY_ABSTRACT_EDITORIAL_FAMILIES.length).toBeGreaterThan(5);
    // families exist for instruction only — never used as filter predicate in prompt builder
    expect(promptSrc).not.toMatch(/CARD_COPY_ABSTRACT_EDITORIAL_FAMILIES/);
  });

  it("H: evidence safety maintained", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/EVIDENCE SAFETY|supportedClaimBoundary|Naturalization must NOT strengthen/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/forbiddenClaimsKo/);
    const p = payload();
    expect((p.canonicalAsset as { forbiddenClaimsKo: string[] }).forbiddenClaimsKo).toContain(
      "개인 경험 단정",
    );
  });

  it("I: density contract preserved", () => {
    expect(INSTAGRAM_CARD_COPY_MOBILE_DENSITY.defaultBodyLines.softTargetMax).toBe(4);
    expect(mobileDensityGuidanceForRole("reframe").bodySoftTargetLines).toBe("3–4");
    expect(mobileDensityGuidanceForRole("context").bodySoftTargetLines).toBe("3–5");
    expect(mobileDensityGuidanceForRole("closing").bodySoftTargetLines).toBe("2–4");
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/~3–4 mobile lines/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Natural Korean ≠ less information/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(/2–3 short lines max — no long exposition/);
  });

  it("J: closing-card natural-language rule", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/CLOSING CARD/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/forced philosophical synthesis/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/concrete fact, contrast, or observation/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(/휴양 프레임 밖에서 읽는 생활 리듬/);
    expect(mobileDensityGuidanceForRole("closing").notes.join(" ")).toMatch(/frame\/rhythm/i);
  });

  it("K: semanticRegistry ownership updated", () => {
    const cardCopy = requireMarketingAgentSemanticContract("instagram-card-copy-writer");
    for (const note of CARD_COPY_SEMANTIC_REGISTRY_NOTES) {
      expect(cardCopy.docs?.notes).toContain(note);
    }
    expect(cardCopy.docs?.notes?.some((n) => /natural Korean surface realization/i.test(n))).toBe(true);
    expect(cardCopy.docs?.notes?.some((n) => /semantic intent, not lexical authority/i.test(n))).toBe(
      true,
    );
  });

  it("L: publishable cardPlan parity with cardCopy", () => {
    const cardCopy: InstagramCardCopy = {
      contract: "instagram-card-copy-v1",
      assetId: "cma_test",
      assetVersion: 1,
      cards: DAO_CARD_COPY_NATURALIZED_FIXTURE.cards.map((c) => ({
        cardId: c.cardId,
        headline: c.headline,
        body: c.body,
      })),
      sourceCarouselFingerprint: "fp_car",
      provenance: {
        sourceAssetId: "cma_test",
        sourceVersion: 1,
        modelProfile: "instagram-card-copy-writer",
        generatedAt: "2026-09-26T00:00:00.000Z",
        sourceUpstreamFingerprint: "fp_car",
      },
    };
    const caption: InstagramCaption = {
      contract: "instagram-caption-v1",
      assetId: "cma_test",
      assetVersion: 1,
      opening: "열기",
      body: "본문",
      cta: null,
      hashtags: ["#test"],
      altText: "alt",
      sourceCardCopyFingerprint: "fp_copy",
      provenance: {
        sourceAssetId: "cma_test",
        sourceVersion: 1,
        modelProfile: "instagram-caption-writer",
        generatedAt: "2026-09-26T00:00:00.000Z",
        sourceUpstreamFingerprint: "fp_copy",
      },
    };
    const plan = assembleInstagramCardPlanFromEditorial({ carousel, cardCopy });
    expect(plan.map((c) => c.headline)).toEqual(cardCopy.cards.map((c) => c.headline));
    expect(plan.map((c) => c.body)).toEqual(cardCopy.cards.map((c) => c.body ?? ""));
    const meta = assembleInstagramMetaFromEditorial({ caption, carousel, cardCopy });
    expect(meta.cardPlan?.map((c) => c.headline)).toEqual(cardCopy.cards.map((c) => c.headline));
  });

  it("M: prompt sections A–D + surface requirements present", () => {
    const user = buildInstagramCardCopyWriterUserPrompt(payload());
    expect(user).toContain("=== A. FACTUAL SOURCE ===");
    expect(user).toContain("=== B. CARD STRUCTURE ===");
    expect(user).toContain("=== C. SEMANTIC INTENT — DO NOT COPY PHRASING ===");
    expect(user).toContain("=== D. SURFACE WRITING REQUIREMENTS ===");
    expect(user).toContain(CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE);
    expect(payload().promptSections).toMatchObject({
      C_SEMANTIC_INTENT: expect.stringContaining("SEMANTIC INTENT ONLY"),
    });
  });

  it("qualitative: Dao naturalized fixture reduces abstraction cluster vs old surface", () => {
    const oldHits = countProblemPhraseHits(DAO_CARD_COPY_OLD_SURFACE);
    const freshHits = countProblemPhraseHits(DAO_CARD_COPY_NATURALIZED_FIXTURE);
    expect(oldHits).toBeGreaterThan(freshHits);
    expect(scoreAbstractionCluster(DAO_CARD_COPY_OLD_SURFACE)).toBeGreaterThan(
      scoreAbstractionCluster(DAO_CARD_COPY_NATURALIZED_FIXTURE),
    );
    // Do not require zero — but problem phrases must not dominate
    for (const card of DAO_CARD_COPY_NATURALIZED_FIXTURE.cards) {
      const text = `${card.headline} ${card.body}`;
      const hits = DAO_CARD_COPY_OLD_PROBLEM_PHRASES.filter((p) => text.includes(p));
      expect(hits.length).toBeLessThanOrEqual(1);
    }
    // Concrete anchors present
    const all = DAO_CARD_COPY_NATURALIZED_FIXTURE.cards.map((c) => `${c.headline} ${c.body}`).join(" ");
    expect(all).toMatch(/랑선|Dao|흙다짐|nhà trình tường|해변|국경/);
    expect(all).not.toMatch(/문화적 맥락을 읽어내/);
    expect(all).not.toMatch(/휴양 프레임 밖에서 읽는 생활 리듬/);
  });
});
