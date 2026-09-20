/**
 * Phase5 Social channel alignment — Threads + Instagram Channel Workers.
 * Focused contract/prompt/MV tests (no Astra API, no image generation).
 */

import { describe, expect, it } from "vitest";

import { buildInstagramCardnewsCards } from "@/lib/marketing/assets/cardnews/instagramCards";
import {
  CHANNEL_EDITOR_COMMON_IDENTITY,
  assembleChannelComposerPromptParts,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  buildChannelComposerInputJson,
  buildChannelComposerPromptParts,
  channelComposerRules,
  formatQualityRevisionPromptBlock,
} from "@/lib/marketing/publishable/composerRuntime";
import {
  isDecisionPracticalArchetype,
  isDiscoveryLikeArchetype,
} from "@/lib/marketing/publishable/editorialArchetype";
import {
  composeInstagramPublishableContent,
  parseInstagramJson,
} from "@/lib/marketing/publishable/instagram/composeInstagramPublishableContent";
import { INSTAGRAM_WRITING_CONTRACT } from "@/lib/marketing/publishable/instagram/writingContract";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  isStableSocialVisualId,
  stableSocialVisualId,
} from "@/lib/marketing/publishable/socialVisualPlan";
import {
  composeThreadsPublishableContent,
  parseThreadsJson,
} from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import { evaluateMarketingValue } from "@/lib/marketing/value/evaluateMarketingValue";
import { PUBLISHABLE_CHANNEL_CONTENT_CONTRACT } from "@/lib/marketing/publishable/contracts";

function baseComposer(overrides: Partial<PublishableComposerInput> = {}): PublishableComposerInput {
  return {
    candidateId: "cand-social-phase5",
    businessDateKst: "2026-09-18",
    topic: "바냐의 숨은 디테일",
    audience: "동유럽 문화 여행자",
    commercialIntent: "informational",
    hookHint: "익숙한 온천 이미지와 다른 점",
    keyMessage: "바냐는 단순한 온천이 아니다",
    destinations: ["부다페스트"],
    entities: ["바냐"],
    usableFacts: [
      {
        statement: "공개 후기에서 건축 디테일이 자주 언급된다",
        epistemicType: "observed",
        confidence: "medium",
        evidenceRefIds: ["ev-1"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: ["특정 마을 방문 확정"],
    governanceDecision: "allow",
    sourceRevision: "rev-1",
    evidenceRefIds: ["ev-1"],
    research: null,
    targetChannels: ["threads", "instagram"],
    contentProposition: {
      contract: "content-proposition-v1",
      primaryAudience: "동유럽 문화 여행자",
      audienceProblem: "온천으로만 알고 있음",
      audienceTension: "익숙한 이미지와 실제 경험이 다를 수 있다",
      contentPromise: "숨은 건축·문화 디테일을 짚어준다",
      readerGain: "같은 장소를 다르게 보게 된다",
      specificTakeaways: ["건축 디테일", "문화 맥락"],
      desiredAudienceAction: "comment",
      engagementMechanism: "save_worthy_checklist",
      propositionStrength: "strong",
      ctaIntent: "댓글로 알려주세요",
      limitations: [],
      forbiddenClaims: [],
    } as never,
    approvedCanonicalAsset: {
      contract: "canonical-marketing-asset-v1",
      assetId: "asset-1",
      status: "approved",
      version: 1,
      approvedVersion: 1,
      sourceRevision: "rev-1",
      titleKo: "바냐, 온천 너머의 건축 디테일",
      dekKo: null,
      openingHookKo: "온천으로만 알면 놓치는 디테일이 있다",
      bodyKo: "공개된 후기에서 자주 보이는 건 물보다 천장과 창문 비율이다. 알고 보면 문화 맥락이 더 크다.",
      keyTakeawaysKo: ["건축 디테일", "문화 맥락"],
      decisionGuidanceKo: "같은 장소를 온천이 아니라 건축·문화로 보면 다르게 읽힌다",
      optionalCtaIntentKo: null,
      supportedClaimBoundaryKo: "공개 콘텐츠에서 관측된 디테일",
      limitationsKo: ["현장 방문 확인 없음"],
      forbiddenClaimsKo: ["특정 마을 확정"],
      unresolvedQuestionsKo: [],
      storyPointId: "sp-1",
      storyPointHash: "hash-1",
      storySupportVerdict: "SUPPORTED",
    } as never,
    storyLock: {
      role: "STORY_LOCK_READ_ONLY",
      storyPointId: "sp-1",
      storyPointHash: "hash-1",
      storyTitleKo: "바냐 숨은 디테일",
      storyQuestionKo: "온천으로만 보면 무엇을 놓칠까?",
      audienceProblemKo: "온천으로만 알고 있음",
      decisionAtStakeKo: null,
      audienceTensionKo: "익숙한 이미지와 실제가 다를 수 있다",
      readerPayoffKo: "같은 장소를 다르게 본다",
      editorialArchetype: "discovery",
    },
    compositionMode: "approved_asset_adapter",
    ...overrides,
  };
}

describe("Phase5 Social — common identity / archetype", () => {
  it("discovery does not require decisionAtStake; decision preserves stakes", () => {
    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(/Do NOT invent or require decisionAtStake/i);
    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(/DISCOVERY-LIKE/i);
    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(/DECISION \/ PRACTICAL/i);
    expect(isDiscoveryLikeArchetype("discovery")).toBe(true);
    expect(isDiscoveryLikeArchetype("cultural_curiosity")).toBe(true);
    expect(isDecisionPracticalArchetype("practical")).toBe(true);
    expect(isDecisionPracticalArchetype("worth_it_or_not")).toBe(true);

    const discovery = baseComposer();
    expect(discovery.storyLock?.decisionAtStakeKo).toBeNull();
    expect(discovery.storyLock?.audienceTensionKo).toBeTruthy();

    const decision = baseComposer({
      storyLock: {
        ...baseComposer().storyLock!,
        editorialArchetype: "practical",
        decisionAtStakeKo: "직항 vs 경유를 먼저 정해야 한다",
      },
    });
    expect(decision.storyLock?.decisionAtStakeKo).toMatch(/직항/);
  });

  it("approved Canonical wins over old proposition CTA pressure", () => {
    const rules = channelComposerRules(baseComposer());
    expect(rules).toMatch(/approved asset \+ archetype win/i);
    expect(rules).toMatch(/save_worthy_checklist must NOT force/i);
  });
});

describe("Phase5 Social — Threads discovery + mediaPlan", () => {
  it("writing contract forbids forced A-vs-B / checklist for discovery", () => {
    expect(THREADS_WRITING_CONTRACT).toMatch(/Do NOT force/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/A와 B/);
    expect(THREADS_WRITING_CONTRACT).not.toMatch(/반드시 체크리스트/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/mediaPlan/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/social_visual_01/);
  });

  it("prompt receives editorialArchetype and approved asset", () => {
    const parts = buildChannelComposerPromptParts({
      channel: "threads",
      writingContract: THREADS_WRITING_CONTRACT,
      composerInput: baseComposer(),
    });
    expect(parts.system).toMatch(/Channel Adapter/i);
    expect(parts.text).toContain("editorialArchetype");
    expect(parts.user).toContain('"editorialArchetype":"discovery"');
    expect(parts.user).toContain("approvedCanonicalAsset");
    expect(parts.user).toContain("STORY_LOCK_READ_ONLY");
  });

  it("parses optional mediaPlan with stable visualIds (0–3)", () => {
    const parsed = parseThreadsJson(
      JSON.stringify({
        title: null,
        body: "온천으로만 알면 놓치는 디테일이 있다.\n\n천장과 창문 비율이 먼저 눈에 띈다.\n\n같은 장소를 다르게 보게 된다.",
        mediaPlan: {
          recommended: true,
          assetFamily: "social_static",
          imageCount: 2,
          visuals: [
            {
              visualId: "social_visual_01",
              role: "cover_context",
              visualIntent: "바냐 건축 외관 맥락 (illustrative)",
              reusableOnInstagram: true,
            },
            {
              visualId: "social_visual_02",
              role: "architecture_detail",
              visualIntent: "천장·창문 비율 디테일",
              reusableOnInstagram: true,
            },
          ],
        },
      }),
    );
    expect(parsed?.mediaPlan?.recommended).toBe(true);
    expect(parsed?.mediaPlan?.imageCount).toBe(2);
    expect(parsed?.mediaPlan?.visuals[0]?.visualId).toBe("social_visual_01");
    expect(isStableSocialVisualId(parsed!.mediaPlan!.visuals[0]!.visualId)).toBe(true);
    expect(stableSocialVisualId(3)).toBe("social_visual_03");
  });

  it("compose stores mediaPlan without invoking any image provider", async () => {
    const content = await composeThreadsPublishableContent({
      composerInput: baseComposer(),
      invoke: async () =>
        JSON.stringify({
          title: null,
          body:
            "온천으로만 알면 놓치는 디테일이 있다. 공개 후기에서 먼저 보이는 건 물보다 천장과 창문 비율이다. 알고 보면 문화 맥락이 더 크다. 같은 장소를 다르게 보게 된다. 건축 디테일.",
          mediaPlan: {
            recommended: true,
            assetFamily: "social_static",
            imageCount: 1,
            visuals: [
              {
                visualId: "social_visual_01",
                role: "cover_context",
                visualIntent: "illustrative cover",
                reusableOnInstagram: true,
              },
            ],
          },
        }),
      allowDeterministicFallback: false,
    });
    expect(content.mediaPlan?.visuals[0]?.visualId).toBe("social_visual_01");
    expect(content.provenance.compositionMode).toBe("approved_asset_adapter");
  });
});

describe("Phase5 Social — Threads decision", () => {
  it("decision contract allows checklist/verification when grounded", () => {
    expect(THREADS_WRITING_CONTRACT).toMatch(/Decision\/practical/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/verification|comparison|consult/i);
  });
});

describe("Phase5 Social — Instagram approved-asset migration", () => {
  it("uses buildChannelComposerPromptParts with approved slice + StoryLock + archetype", () => {
    const parts = buildChannelComposerPromptParts({
      channel: "instagram",
      writingContract: INSTAGRAM_WRITING_CONTRACT,
      composerInput: baseComposer(),
    });
    expect(parts.system).toMatch(/Storyboard Editor/i);
    expect(parts.user).toContain("approvedCanonicalAsset");
    expect(parts.user).toContain("STORY_LOCK_READ_ONLY");
    expect(parts.user).toContain('"editorialArchetype":"discovery"');
    expect(parts.user).not.toContain("usableFacts");
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/Storyboard Editor/);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/SMALLEST sufficient/i);
    expect(INSTAGRAM_WRITING_CONTRACT).not.toMatch(/PROPOSITION_COMPOSER_RULES/);
  });

  it("legacy proposition-only INPUT_JSON path is no longer active in approved mode", () => {
    const json = buildChannelComposerInputJson(baseComposer());
    expect(json.compositionMode).toBe("approved_asset_adapter");
    expect(json.approvedCanonicalAsset).toBeTruthy();
    expect(json.editorialArchetype).toBe("discovery");
    expect(json).not.toHaveProperty("usableFacts");
  });

  it("parse cardPlan maps to CardNewsCard-compatible fields including evidence role", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({
        hook: "온천으로만 알면 놓치는 디테일이 있다.",
        body: "온천으로만 알면 놓치는 디테일이 있다.\n\n한계: 현장 방문 확인 없음.\n\n#부다페스트 #바냐 #건축",
        hashtags: ["#부다페스트", "#바냐", "#건축"],
        cta: null,
        altText: "바냐 건축 디테일",
        aspectRatio: "4:5",
        slideHeadlines: ["놓치는 디테일", "익숙한 온천 이미지", "천장과 창문", "관측 한계", "다르게 보기"],
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "놓치는 디테일",
            body: "온천으로만 보면",
            visualIntent: "hook visual",
            visual: {
              visualId: "social_visual_01",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              reusableOnThreads: true,
              visualIntent: "cover context",
            },
          },
          {
            cardId: "card-02",
            role: "information",
            headline: "익숙한 온천 이미지",
            body: "출발점",
            visualIntent: "",
            visual: {
              visualId: "social_visual_02",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "orientation",
            },
          },
          {
            cardId: "card-03",
            role: "information",
            headline: "천장과 창문",
            body: "비율이 먼저 보인다",
            visualIntent: "detail",
            visual: {
              visualId: "social_visual_03",
              visualMode: "architecture_detail",
              generatedVisualNeeded: true,
              reusableOnThreads: true,
              visualIntent: "architecture detail",
            },
          },
          {
            cardId: "card-04",
            role: "evidence",
            headline: "관측 한계",
            body: "현장 방문 확인 없음",
            visualIntent: "evidence boundary",
            evidenceRefs: ["ev-1"],
            visual: {
              visualId: "social_visual_04",
              visualMode: "evidence_boundary",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "boundary",
            },
          },
          {
            cardId: "card-05",
            role: "information",
            headline: "다르게 보기",
            body: "문화 맥락",
            visualIntent: "payoff",
          },
        ],
      }),
    );
    expect(parsed?.meta.cardPlan?.length).toBe(5);
    expect(parsed?.meta.cardPlan?.[0]?.visual?.visualId).toBe("social_visual_01");
    expect(parsed?.meta.cardPlan?.[0]?.visual?.generatedVisualNeeded).toBe(true);
    expect(parsed?.meta.slideHeadlines).toHaveLength(5);

    const cards = buildInstagramCardnewsCards(
      {
        contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
        channel: "instagram",
        format: "instagram_caption",
        title: null,
        body: parsed!.body,
        status: "generated",
        generatedAt: new Date().toISOString(),
        sourceCandidateId: "c",
        sourceRevision: "r",
        provenance: {
          composer: "llm",
          evidenceRefIds: ["ev-1"],
          commercialIntent: "informational",
        },
        validation: { ok: true, issues: [] },
        instagramMeta: parsed!.meta,
      },
      ["ev-1"],
    );
    expect(cards.some((c) => c.role === "evidence")).toBe(true);
    expect(cards[0]?.role).toBe("cover");
    expect(cards.every((c) => typeof c.headline === "string")).toBe(true);
    // Planning visualId must NOT leak into CardNewsCard schema fields as required keys
    expect(cards[0]).not.toHaveProperty("visualId");
  });

  it("compose uses approved-asset adapter path", async () => {
    const content = await composeInstagramPublishableContent({
      composerInput: baseComposer(),
      invoke: async (prompt) => {
        const text = typeof prompt === "string" ? prompt : prompt.text;
        expect(text).toContain("CHANNEL_EDITOR_IDENTITY");
        expect(text).toContain("approvedCanonicalAsset");
        expect(text).toContain('"editorialArchetype":"discovery"');
        expect(text).not.toMatch(/INPUT_JSON:\s*\{[^}]*usableFacts/);
        return JSON.stringify({
          hook: "온천으로만 알면 놓치는 디테일이 있다.",
          body: "온천으로만 알면 놓치는 디테일이 있다.\n\n천장과 창문 비율이 먼저 보인다. 알고 보면 문화 맥락이 더 크다.\n\n#부다페스트 #바냐 #건축",
          hashtags: ["#부다페스트", "#바냐", "#건축"],
          cta: null,
          altText: "바냐",
          slideHeadlines: ["놓치는 디테일", "익숙한 이미지", "천장과 창문", "다르게 보기"],
          cardPlan: [
            { cardId: "c1", role: "cover", headline: "놓치는 디테일", body: "", visualIntent: "a" },
            { cardId: "c2", role: "information", headline: "익숙한 이미지", body: "", visualIntent: "b" },
            { cardId: "c3", role: "information", headline: "천장과 창문", body: "", visualIntent: "c" },
            { cardId: "c4", role: "information", headline: "다르게 보기", body: "", visualIntent: "d" },
          ],
        });
      },
      allowDeterministicFallback: false,
    });
    expect(content.provenance.compositionMode).toBe("approved_asset_adapter");
    expect(content.instagramMeta?.slideHeadlines.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Phase5 Social — visual planning safety / no Astra", () => {
  it("contracts forbid image generation and keep planning-only semantics", () => {
    expect(THREADS_WRITING_CONTRACT).toMatch(/NO image generation/i);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/Do NOT generate images/i);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/Do NOT call any image provider/i);
    expect(THREADS_WRITING_CONTRACT + INSTAGRAM_WRITING_CONTRACT).not.toMatch(/openai\.com|astra api|chatgpt api/i);
  });

  it("shared visualId semantics are consistent across surfaces", () => {
    expect(stableSocialVisualId(1)).toBe("social_visual_01");
    expect(stableSocialVisualId(2)).toBe("social_visual_02");
  });
});

describe("Phase5 Social — Marketing Value archetype", () => {
  it("discovery without checklist is not penalized solely for no checklist", () => {
    const discoveryBody =
      "온천으로만 알면 놓치는 디테일이 있다. 알고 보면 천장과 창문 비율이 먼저 눈에 띈다. 같은 장소를 다르게 보게 된다. 건축 디테일과 문화 맥락.";
    const prop = baseComposer().contentProposition!;
    const discovery = evaluateMarketingValue({
      channel: "threads",
      body: discoveryBody,
      content: null,
      proposition: prop,
      editorialArchetype: "discovery",
    });
    expect(discovery.hardFailReasons).not.toContain("no_useful_takeaway");
    expect(
      discovery.improvementHints.some((h) => /checklist/i.test(h)),
    ).toBe(false);
    expect(discovery.engagementPotentialScore).toBeGreaterThanOrEqual(55);

    const decision = evaluateMarketingValue({
      channel: "threads",
      body: "직항과 경유를 먼저 비교하세요. 1) 출발 시간 2) 포함 여부 3) 환승 대기. 체크리스트로 저장해 두세요.",
      content: null,
      proposition: {
        ...prop,
        engagementMechanism: "save_worthy_checklist",
        desiredAudienceAction: "save",
      } as never,
      editorialArchetype: "practical",
    });
    expect(decision.engagementPotentialScore).toBeGreaterThanOrEqual(70);
  });
});

describe("Phase5 Social — Quality Revision archetype", () => {
  it("discovery repair contains no mandatory checklist instruction", () => {
    const discovery = formatQualityRevisionPromptBlock(
      {
        reasons: ["weak_hook"],
        hints: ["more concrete"],
        priorBody: "이전 본문",
      },
      "discovery",
    );
    expect(discovery).toMatch(/discovery value/i);
    expect(discovery).toMatch(/Do NOT inject a checklist/i);
    expect(discovery).not.toMatch(/concrete checklist or numbered takeaways/);

    const practical = formatQualityRevisionPromptBlock(
      {
        reasons: ["not_save_worthy"],
        hints: ["add checks"],
        priorBody: "이전 본문",
      },
      "practical",
    );
    expect(practical).toMatch(/checklist|criteria/i);
  });
});

describe("Phase5 Social — assemble path sanity", () => {
  it("instagram approved mode still uses assembleChannelComposerPromptParts shape", () => {
    const parts = assembleChannelComposerPromptParts({
      channel: "instagram",
      writingContract: "WC",
      channelRules: "RULES",
      inputJson: { compositionMode: "approved_asset_adapter", editorialArchetype: "discovery" },
      storyLockText: "LOCK",
    });
    expect(parts.text).toContain("=== CHANNEL_EDITOR_IDENTITY ===");
    expect(parts.user).toContain("=== STORY_LOCK_READ_ONLY ===");
  });
});
