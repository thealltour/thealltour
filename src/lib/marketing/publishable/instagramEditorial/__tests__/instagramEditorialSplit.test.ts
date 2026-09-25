/**
 * Instagram Editorial Split — materialize, assemble, lifecycle, Dao regression fixture.
 */

import { describe, expect, it } from "vitest";

import {
  assembleInstagramMetaFromEditorial,
  assemblePublishableInstagramFromEditorial,
  adaptEditorialToSharedVisualPlannerCards,
  deriveLegacySlideHeadlines,
} from "@/lib/marketing/publishable/instagramEditorial/assemblePublishable";
import {
  buildInstagramCardCopyWriterPayload,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import {
  materializeEditorialNarrativePlan,
  materializeInstagramCaption,
  materializeInstagramCardCopy,
  materializeInstagramCarouselPlan,
  InstagramEditorialMaterializeError,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  buildEditorialNarrativeContentFingerprint,
  buildEditorialNarrativeSourceFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { INSTAGRAM_CARD_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { resolveInstagramEditorialPipelineLifecycle } from "@/lib/marketing/publishable/instagramEditorial/lifecycle";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { getMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";

/** Dao-like Canonical facts — regression fixture (no live LLM). */
const DAO_FACTS = {
  familiar: "해변·리조트·대도시로 익숙한 베트남",
  reframe: "북부 국경 산악 지대에서는 풍경부터 달라진다",
  context: "랑선 등 북부 국경 지대 Dao족 마을",
  evidence: "전통 판축 가옥 nhà trình tường(흙다짐)",
  payoff: "익숙한 휴양 프레임 밖에서 건축·생활 리듬을 읽게 된다",
};

function daoNarrativeLlm() {
  return {
    narrativePromise: "익숙한 베트남 휴양 프레임을 북부 국경 Dao족·흙다짐 주택으로 재구성한다",
    audienceTakeaway: "해변 리조트만이 베트남이 아니라는 인식",
    beats: [
      {
        beatId: "beat_01",
        purpose: "hook",
        message: "다낭·푸꾸옥으로 기억하는 베트남 풍경을 떠올린다",
      },
      {
        beatId: "beat_02",
        purpose: "familiar_frame",
        message: DAO_FACTS.familiar,
      },
      {
        beatId: "beat_03",
        purpose: "reframe",
        message: DAO_FACTS.reframe,
      },
      {
        beatId: "beat_04",
        purpose: "context",
        message: DAO_FACTS.context,
      },
      {
        beatId: "beat_05",
        purpose: "detail",
        message: DAO_FACTS.evidence,
        evidenceRefs: ["ev_dao_house"],
      },
      {
        beatId: "beat_06",
        purpose: "payoff",
        message: DAO_FACTS.payoff,
      },
    ],
  };
}

function daoCarouselLlm() {
  return {
    cards: [
      {
        cardId: "card-01",
        role: "hook_cover",
        beatIds: ["beat_01"],
        communicationGoal: "왜 스와이프하는지 — 익숙한 베트남 이미지를 소환",
        visualPriority: "hero",
      },
      {
        cardId: "card-02",
        role: "reframe",
        beatIds: ["beat_03"],
        communicationGoal: "북쪽으로 올라가면 풍경이 달라진다는 새 정보",
        visualPriority: "strong",
      },
      {
        cardId: "card-03",
        role: "context",
        beatIds: ["beat_04"],
        communicationGoal: "랑선·Dao족 맥락 제시",
        visualPriority: "useful",
      },
      {
        cardId: "card-04",
        role: "evidence_detail",
        beatIds: ["beat_05"],
        communicationGoal: "nhà trình tường 건축 디테일",
        visualPriority: "strong",
      },
      {
        cardId: "card-05",
        role: "closing",
        beatIds: ["beat_06"],
        communicationGoal: "스토리 payoff — 프레임이 바뀐다",
        visualPriority: "optional",
      },
    ],
  };
}

function daoCardCopyLlm() {
  return {
    cards: [
      {
        cardId: "card-01",
        headline: "해변으로 기억하는 베트남",
        body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
      },
      {
        cardId: "card-02",
        headline: "북쪽으로 올라가면 풍경부터 달라집니다",
        body: "산악 국경 지대에서는 휴양 리조트와 다른 고도·안개·산길의 리듬이 이어집니다",
      },
      {
        cardId: "card-03",
        headline: "랑선 국경, Dao족 마을",
        body: "산비탈의 경작지와 길, 주거 공간이 한 지형 안에 이어지는 북부 산악 생활환경을 보여줍니다",
      },
      {
        cardId: "card-04",
        headline: "nhà trình tường, 흙다짐 가옥",
        body: "흙을 층층이 다져 벽을 만드는 nhà trình tường은 북부 산악 주거의 건축 방식을 보여주는 구체적 단서입니다",
        evidenceRefs: ["ev_dao_house"],
      },
      {
        cardId: "card-05",
        headline: "휴양 프레임 밖에서 읽히는 베트남",
        body: "해변 요약이 아니라 랑선 Dao족 마을과 흙다짐 가옥까지 이어진 건축·생활 리듬이 payoff입니다",
      },
    ],
  };
}

function daoCaptionLlm() {
  return {
    opening: "해변 리조트로만 베트남을 기억했다면, 북부 국경의 풍경부터 다시 보세요.",
    body: "랑선 일대 Dao족 마을의 nhà trình tường(흙다짐 가옥)은 관광 광고가 아니라 건축·생활 리듬의 단서입니다. 근거는 공식 소개에 한정됩니다.",
    cta: "다른 여행 프레임이 떠오르면 저장해 두세요",
    hashtags: ["베트남여행", "랑선", "Dao족", "전통건축", "여행기록"],
    altText: "북부 국경 산악 지대 Dao족 마을과 흙다짐 가옥을 소개하는 카드뉴스",
  };
}

function minimalComposerInput(): PublishableComposerInput {
  return {
    candidateId: "cand_dao_fixture",
    businessDateKst: "2026-09-18",
    topic: "Dao족 nhà trình tường",
    audience: null,
    commercialIntent: "awareness",
    hookHint: null,
    keyMessage: null,
    destinations: ["랑선"],
    entities: ["Dao"],
    usableFacts: [
      {
        statement: DAO_FACTS.evidence,
        confidence: "high",
        evidenceRefIds: ["ev_dao_house"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: [],
    governanceDecision: "PASS",
    sourceRevision: "src_dao_v1",
    evidenceRefIds: ["ev_dao_house"],
    research: null,
    targetChannels: ["instagram"],
    compositionMode: "approved_asset_adapter",
  };
}

describe("instagram editorial materialize", () => {
  it("narrative: stable beat ids, order preserved, rejects duplicate beatId", () => {
    const plan = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp_canon",
      modelProfile: "editorial-narrative-planner",
      llm: daoNarrativeLlm(),
    });
    expect(plan.beats.map((b) => b.beatId)).toEqual([
      "beat_01",
      "beat_02",
      "beat_03",
      "beat_04",
      "beat_05",
      "beat_06",
    ]);
    expect(plan.beats[2]?.purpose).toBe("reframe");
    expect(() =>
      materializeEditorialNarrativePlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCanonicalFingerprint: "fp",
        modelProfile: "x",
        llm: {
          narrativePromise: "p",
          audienceTakeaway: "t",
          beats: [
            { beatId: "beat_01", purpose: "hook", message: "a" },
            { beatId: "beat_01", purpose: "reframe", message: "b" },
          ],
        },
      }),
    ).toThrow(InstagramEditorialMaterializeError);
  });

  it("carousel: unique cardIds, valid beat refs, communicationGoal required", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp",
      modelProfile: "editorial-narrative-planner",
      llm: daoNarrativeLlm(),
    });
    const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: narrativeFp,
      modelProfile: "instagram-carousel-planner",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    expect(new Set(carousel.cards.map((c) => c.cardId)).size).toBe(5);
    expect(carousel.cards.every((c) => c.communicationGoal.trim().length > 0)).toBe(true);
    expect(() =>
      materializeInstagramCarouselPlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceNarrativeFingerprint: narrativeFp,
        modelProfile: "x",
        validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
        minCards: 3,
        maxCards: 10,
        llm: {
          cards: [
            {
              cardId: "card-01",
              role: "hook_cover",
              beatIds: ["beat_missing"],
              communicationGoal: "x",
              visualPriority: "hero",
            },
            {
              cardId: "card-02",
              role: "reframe",
              beatIds: ["beat_03"],
              communicationGoal: "y",
              visualPriority: "strong",
            },
            {
              cardId: "card-03",
              role: "context",
              beatIds: ["beat_04"],
              communicationGoal: "z",
              visualPriority: "useful",
            },
          ],
        },
      }),
    ).toThrow(/unknown beat/i);
  });

  it("card copy: exact card id match; empty headline rejected", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp",
      modelProfile: "x",
      llm: daoNarrativeLlm(),
    });
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(narrative),
      modelProfile: "x",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    const copy = materializeInstagramCardCopy({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      modelProfile: "x",
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: daoCardCopyLlm(),
    });
    expect(copy.cards.map((c) => c.cardId)).toEqual(carousel.cards.map((c) => c.cardId));
    expect(copy.cards[3]?.evidenceRefs).toEqual(["ev_dao_house"]);
    expect(() =>
      materializeInstagramCardCopy({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCarouselFingerprint: "fp",
        modelProfile: "x",
        expectedCardIds: ["card-01", "card-02", "card-03", "card-04", "card-05"],
        llm: {
          cards: daoCardCopyLlm().cards.map((c, i) =>
            i === 0 ? { ...c, headline: "  " } : c,
          ),
        },
      }),
    ).toThrow(/headline/);
  });

  it("caption: hashtags normalized, altText required", () => {
    const caption = materializeInstagramCaption({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCardCopyFingerprint: "fp_copy",
      modelProfile: "x",
      hashtagMax: 12,
      llm: {
        ...daoCaptionLlm(),
        hashtags: ["베트남여행", "##랑선", " Dao족 "],
      },
    });
    expect(caption.hashtags).toEqual(["#베트남여행", "#랑선", "#Dao족"]);
    expect(caption.altText.length).toBeGreaterThan(0);
  });
});

describe("Dao fixture story progression (editorial assemble)", () => {
  it("cards form one progressing story — not five synonymous summaries", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp",
      modelProfile: "editorial-narrative-planner",
      llm: daoNarrativeLlm(),
    });
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(narrative),
      modelProfile: "instagram-carousel-planner",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    const cardCopy = materializeInstagramCardCopy({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      modelProfile: "instagram-card-copy-writer",
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: daoCardCopyLlm(),
    });
    const caption = materializeInstagramCaption({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
      modelProfile: "instagram-caption-writer",
      hashtagMax: 12,
      llm: daoCaptionLlm(),
    });

    expect(carousel.cards.map((c) => c.role)).toEqual([
      "hook_cover",
      "reframe",
      "context",
      "evidence_detail",
      "closing",
    ]);

    const headlines = cardCopy.cards.map((c) => c.headline);
    // Anti-regression: old Dao bug was card1/2 both "familiar Vietnam scenery" paraphrases
    expect(headlines[0]).toMatch(/해변|리조트|기억하는/);
    expect(headlines[1]).toMatch(/북쪽|달라/);
    expect(headlines[1]).not.toMatch(/익숙한 베트남의 풍경 너머/);
    expect(headlines[3]).toMatch(/nhà trình tường|흙다짐/i);
    expect(headlines[4]).not.toMatch(/완벽한|숨겨진|충격/);

    const meta = assembleInstagramMetaFromEditorial({ caption, carousel, cardCopy });
    expect(meta.slideHeadlines).toEqual(deriveLegacySlideHeadlines(cardCopy));
    expect(meta.cardPlan?.every((c) => !c.visual)).toBe(true);
    expect(meta.cardPlan?.[0]?.role).toBe("cover");
    expect(meta.cardPlan?.[3]?.role).toBe("evidence");

    const svpCards = adaptEditorialToSharedVisualPlannerCards({ carousel, cardCopy });
    expect(svpCards).toHaveLength(5);
    expect(svpCards[0]?.visualPriority).toBe("hero");
    expect(svpCards[3]?.headline).toMatch(/nhà trình tường/i);

    const content = assemblePublishableInstagramFromEditorial({
      composerInput: minimalComposerInput(),
      narrative,
      carousel,
      cardCopy,
      caption,
      nowIso: "2026-09-20T00:00:00.000Z",
      attemptCount: 4,
      latencyMs: 10,
    });
    expect(content.channel).toBe("instagram");
    expect(content.publishableSuccess).toBe(true);
    expect(content.instagramMeta?.slideHeadlines.length).toBe(5);
    expect(content.body).toContain("#베트남여행");
  });
});

describe("instagram editorial lifecycle fingerprints", () => {
  it("canonical change → narrative stale → downstream stale", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: buildEditorialNarrativeSourceFingerprint({
        assetId: "cma_dao",
        assetVersion: 1,
        canonicalFingerprint: "canon_v1",
      }),
      modelProfile: "x",
      llm: daoNarrativeLlm(),
    });
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(narrative),
      modelProfile: "x",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    const cardCopy = materializeInstagramCardCopy({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      modelProfile: "x",
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: daoCardCopyLlm(),
    });
    const caption = materializeInstagramCaption({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
      modelProfile: "x",
      hashtagMax: 12,
      llm: daoCaptionLlm(),
    });

    const fresh = resolveInstagramEditorialPipelineLifecycle({
      expectedCanonicalFingerprint: narrative.sourceCanonicalFingerprint,
      narrative,
      carousel,
      cardCopy,
      caption,
    });
    expect(fresh.pipeline).toBe("fresh");

    const afterCanon = resolveInstagramEditorialPipelineLifecycle({
      expectedCanonicalFingerprint: "canon_v2_changed",
      narrative,
      carousel,
      cardCopy,
      caption,
    });
    expect(afterCanon.narrative).toBe("stale");
    expect(afterCanon.pipeline).toBe("stale");

    const mutatedNarrative = {
      ...narrative,
      narrativePromise: "changed promise",
    };
    const afterNarrative = resolveInstagramEditorialPipelineLifecycle({
      expectedCanonicalFingerprint: narrative.sourceCanonicalFingerprint,
      narrative: mutatedNarrative,
      carousel,
      cardCopy,
      caption,
    });
    expect(afterNarrative.carousel).toBe("stale");
    expect(afterNarrative.cardCopy).toBe("stale");
    expect(afterNarrative.caption).toBe("stale");
  });

  it("carousel change → card copy + caption stale", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp",
      modelProfile: "x",
      llm: daoNarrativeLlm(),
    });
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(narrative),
      modelProfile: "x",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    const cardCopy = materializeInstagramCardCopy({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      modelProfile: "x",
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: daoCardCopyLlm(),
    });
    const caption = materializeInstagramCaption({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
      modelProfile: "x",
      hashtagMax: 12,
      llm: daoCaptionLlm(),
    });

    const mutatedCarousel = {
      ...carousel,
      cards: carousel.cards.map((c, i) =>
        i === 1 ? { ...c, communicationGoal: "changed goal" } : c,
      ),
    };
    const life = resolveInstagramEditorialPipelineLifecycle({
      expectedCanonicalFingerprint: "fp",
      narrative,
      carousel: mutatedCarousel,
      cardCopy,
      caption,
    });
    expect(life.cardCopy).toBe("stale");
    expect(life.caption).toBe("stale");
  });
});

describe("instagram card copy context density contract", () => {
  it("A. prompt cards include role / beatIds / beatMessages / communicationGoal", () => {
    const narrative = materializeEditorialNarrativePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCanonicalFingerprint: "fp",
      modelProfile: "x",
      llm: daoNarrativeLlm(),
    });
    const carousel = materializeInstagramCarouselPlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(narrative),
      modelProfile: "x",
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 3,
      maxCards: 10,
      llm: daoCarouselLlm(),
    });
    const payload = buildInstagramCardCopyWriterPayload({
      narrative,
      carousel,
      canonicalAsset: {
        assetId: "cma_dao",
        titleKo: "title",
        openingHookKo: "hook",
        bodyKo: "body",
        keyTakeawaysKo: ["a"],
        supportedClaimBoundaryKo: "boundary",
        forbiddenClaimsKo: ["금지주장"],
      },
    });
    const cards = payload.cards as Array<Record<string, unknown>>;
    expect(cards).toHaveLength(5);
    expect(cards[0]).toMatchObject({
      cardId: "card-01",
      role: "hook_cover",
      beatIds: ["beat_01"],
      communicationGoal: expect.any(String),
      visualPriority: "hero",
    });
    expect(cards[0]!.beatMessages).toEqual([
      {
        beatId: "beat_01",
        purpose: "hook",
        message: "다낭·푸꾸옥으로 기억하는 베트남 풍경을 떠올린다",
      },
    ]);
    expect(cards[2]!.role).toBe("context");
    expect((cards[2]!.beatMessages as unknown[]).length).toBeGreaterThan(0);
    const canon = payload.canonicalAsset as Record<string, unknown>;
    expect(canon.openingHookKo).toBe("hook");
    expect(canon.forbiddenClaimsKo).toEqual(["금지주장"]);
  });

  it("B/C. SOUL distinguishes summary vs context and deprioritizes 2–3 line max", () => {
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Summary vs context/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/DO NOT summarize the whole source/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/select the context required by/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/Information density/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toMatch(
      /^\s*- Body: optional 2–3 short lines max/m,
    );
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(
      /Do \*\*not\*\* treat "2–3 short lines max" as the goal/,
    );
  });

  it("D/E/F. semantic contract expands OWNS; closing CTA not forced; carousel not owned", () => {
    const contract = getMarketingAgentSemanticContract("instagram-card-copy-writer");
    expect(contract).toBeTruthy();
    const notes = contract!.docs?.notes?.join("\n") ?? "";
    expect(notes).toMatch(/card-level contextual explanation/i);
    expect(notes).toMatch(/information density/i);
    expect(notes).toMatch(/MUST NOT OWN:[\s\S]*cardId/i);
    expect(contract!.authority.owns).toEqual(["instagram.cardCopy"]);
    expect(contract!.authority.mustNotOwn).toContain("instagram.carouselStructure");
    expect(contract!.authority.mustNotOwn).toContain("presentation.template");
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/not\*\* CTA by default/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/do not force CTA/);
  });

  it("Dao fixture: progression / density direction (no abstract-only 03/04; 05 recovers)", () => {
    const copy = daoCardCopyLlm().cards;
    const staleAbstract = ["거주 배경과 생활문화", "보여주는 면모", "도시 중심의 익숙한 베트남"];
    for (const card of copy) {
      for (const phrase of staleAbstract) {
        expect(`${card.headline}\n${card.body ?? ""}`.includes(phrase)).toBe(false);
      }
    }
    // card-02 must not merely restate beach/resort premise
    expect(copy[1]!.body!).not.toMatch(/다낭·푸꾸옥·리조트 이미지가 먼저/);
    expect(copy[1]!.body!).toMatch(/산악|국경|고도|리듬/);
    // card-03/04 need concrete detail beyond abstract labels
    expect((copy[2]!.body ?? "").length).toBeGreaterThan(30);
    expect(copy[2]!.body!).toMatch(/산비탈|경작|주거|랑선|Dao/);
    expect(copy[3]!.body!).toMatch(/nhà trình tường|흙|벽|건축/);
    // closing recovers prior cards rather than slogan-only
    expect(copy[4]!.body!).toMatch(/랑선|Dao|흙다짐|가옥/);
    expect(copy[4]!.body!).not.toMatch(/또 하나의 기준|다양한 시각/);
  });
});
