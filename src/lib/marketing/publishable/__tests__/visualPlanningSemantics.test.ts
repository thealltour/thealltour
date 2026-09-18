/**
 * Instagram + Threads visual planning semantics — hybrid editorial carousel.
 * Does not modify planner/handoff/orchestration.
 */
import { describe, expect, it } from "vitest";

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  composeInstagramPublishableContent,
  parseInstagramJson,
} from "@/lib/marketing/publishable/instagram/composeInstagramPublishableContent";
import { INSTAGRAM_WRITING_CONTRACT } from "@/lib/marketing/publishable/instagram/writingContract";
import { buildManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff";
import { buildSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  composeThreadsPublishableContent,
  parseThreadsJson,
} from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";

const DAO_CAPTION = [
  "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남.",
  "",
  "익숙한 휴양 이미지와 달리, 공개 기록에 담긴 산악·국경 생활문화가 시야를 넓혀 줍니다.",
  "세부 마을이나 현장 체험은 확인되지 않았으니 그 한계도 함께 둡니다.",
  "",
  "#베트남여행 #북부베트남 #여행시야",
].join("\n");

/** Corrected hybrid Worker output for the Dao travel-discovery fixture. */
function daoInstagramHybridJson(): string {
  return JSON.stringify({
    hook: "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남.",
    body: DAO_CAPTION,
    hashtags: ["#베트남여행", "#북부베트남", "#여행시야"],
    cta: null,
    altText: "북부 베트남 산악·국경 맥락의 여행 시야 확장",
    aspectRatio: "4:5",
    slideHeadlines: [
      "해변만의 베트남?",
      "북부 국경 산악으로",
      "흙다짐 주택의 결",
      "시야가 넓어지는 지점",
      "확인된 범위까지",
    ],
    cardPlan: [
      {
        cardId: "card-01",
        role: "cover",
        headline: "해변만의 베트남?",
        body: "익숙한 휴양 이미지와 다른 북부 맥락",
        visualIntent: "familiar beach/city vs northern mountain border atmosphere",
        evidenceRefs: [],
        visual: {
          visualId: "social_visual_01",
          visualMode: "editorial_photo",
          generatedVisualNeeded: true,
          reusableOnThreads: true,
          visualIntent: "northern mountain/border-region editorial context (illustrative)",
        },
      },
      {
        cardId: "card-02",
        role: "information",
        headline: "북부 국경 산악으로",
        body: "공개 기록이 보여주는 생활문화 층위",
        visualIntent: "typography orientation",
        evidenceRefs: [],
        visual: {
          visualId: "social_visual_02",
          visualMode: "typography",
          generatedVisualNeeded: false,
          reusableOnThreads: false,
          visualIntent: "orientation typography",
        },
      },
      {
        cardId: "card-03",
        role: "information",
        headline: "흙다짐 주택의 결",
        body: "nhà trình tường — 검증된 건축 개념의 질감",
        visualIntent: "rammed-earth house architectural detail",
        evidenceRefs: [],
        visual: {
          visualId: "social_visual_03",
          visualMode: "object_or_detail",
          generatedVisualNeeded: true,
          reusableOnThreads: true,
          visualIntent: "nhà trình tường architectural detail (evidence-safe concept)",
        },
      },
      {
        cardId: "card-04",
        role: "information",
        headline: "시야가 넓어지는 지점",
        body: "휴양 중심 인식 vs 북부 문화 탐방",
        visualIntent: "contrast diagram",
        evidenceRefs: [],
        visual: {
          visualId: "social_visual_04",
          visualMode: "contrast_diagram",
          generatedVisualNeeded: false,
          reusableOnThreads: false,
          visualIntent: "resort vs northern cultural exploration contrast",
        },
      },
      {
        cardId: "card-05",
        role: "evidence",
        headline: "확인된 범위까지",
        body: "세부 마을·현장 체험은 미확인",
        visualIntent: "evidence boundary",
        evidenceRefs: [],
        visual: {
          visualId: "social_visual_05",
          visualMode: "evidence_boundary",
          generatedVisualNeeded: false,
          reusableOnThreads: false,
          visualIntent: "limitation / evidence boundary close",
        },
      },
    ],
  });
}

function daoThreadsMediaJson(): string {
  return JSON.stringify({
    title: null,
    body: [
      "해변과 리조트만 떠올렸다면, 북부 국경지대에서 이야기가 달라집니다.",
      "",
      "공개 기록에 담긴 Dao족과 nhà trình tường(흙다짐 주택)은 익숙한 휴양 이미지 밖의 생활문화 층을 보여줍니다.",
      "",
      "세부 마을이나 현장 체험은 확인되지 않았습니다. 확인된 범위까지만 시야를 넓혀 보세요.",
    ].join("\n"),
    mediaPlan: {
      recommended: true,
      assetFamily: "social_static",
      imageCount: 2,
      visuals: [
        {
          visualId: "social_visual_01",
          role: "cover_context",
          visualIntent: "northern mountain/border editorial context",
          reusableOnInstagram: true,
        },
        {
          visualId: "social_visual_02",
          role: "architecture_detail",
          visualIntent: "nhà trình tường architectural detail",
          reusableOnInstagram: true,
        },
      ],
    },
  });
}

function channelBase(
  channel: PublishableChannelContent["channel"],
  format: PublishableChannelContent["format"],
  body: string,
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format,
    title: null,
    body,
    status: "generated",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceCandidateId: "cmc_dao",
    sourceRevision: "rev1",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: "informational",
      generationMode: "llm",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    sourceAssetId: "asset_dao",
    sourceAssetVersion: 2,
  };
}

describe("Visual planning semantics — contracts", () => {
  it("Instagram contract teaches hybrid carousel (not all-local / not all-Astra)", () => {
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/hybrid editorial carousel/i);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/editorial_photo/);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/object_or_detail/);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/generatedVisualNeeded=true/);
    expect(INSTAGRAM_WRITING_CONTRACT).toMatch(/1–3 external/);
    expect(INSTAGRAM_WRITING_CONTRACT).not.toMatch(/true only when an external editorial visual would help/);
  });

  it("Threads contract prefers media for concrete discovery subjects without forcing every post", () => {
    expect(THREADS_WRITING_CONTRACT).toMatch(/recommended=true/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/imageCount 1–2/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/Do NOT force media for every Threads post/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/rather than defaulting to null/);
  });
});

describe("Visual planning semantics — Instagram parse + Dao hybrid", () => {
  it("A/B/C/D. Dao fixture hybrid: cover+architecture true; evidence false; not all true", () => {
    const parsed = parseInstagramJson(daoInstagramHybridJson());
    expect(parsed).toBeTruthy();
    const cards = parsed!.meta.cardPlan!;
    expect(cards.length).toBe(5);

    const needed = cards.filter((c) => c.visual?.generatedVisualNeeded);
    expect(needed.length).toBeGreaterThanOrEqual(1);
    expect(needed.length).toBeLessThan(cards.length);

    const cover = cards.find((c) => c.role === "cover");
    expect(cover?.visual?.visualMode).toBe("editorial_photo");
    expect(cover?.visual?.generatedVisualNeeded).toBe(true);

    const arch = cards.find((c) => c.visual?.visualMode === "object_or_detail");
    expect(arch?.visual?.generatedVisualNeeded).toBe(true);
    expect(arch?.visual?.visualIntent.toLowerCase()).toMatch(/nhà trình tường|architectural/);

    const evidence = cards.find((c) => c.role === "evidence" || c.visual?.visualMode === "evidence_boundary");
    expect(evidence?.visual?.generatedVisualNeeded).toBe(false);
  });

  it("E. practical typography/checklist story may stay mostly local", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({
        hook: "체크리스트로 정리한 출발 전 확인.",
        body: `${"가".repeat(80)}\n\n#여행준비 #체크리스트 #출국준비`,
        hashtags: ["#여행준비", "#체크리스트", "#출국준비"],
        cta: "저장해 두고 확인하세요",
        altText: "checklist",
        aspectRatio: "4:5",
        slideHeadlines: ["준비1", "준비2", "준비3", "준비4"],
        cardPlan: [1, 2, 3, 4].map((n) => ({
          cardId: `card-0${n}`,
          role: n === 1 ? "cover" : n === 4 ? "cta" : "information",
          headline: `준비${n}`,
          body: "체크",
          visualIntent: "typography checklist",
          visual: {
            visualId: `social_visual_0${n}`,
            visualMode: n === 4 ? "minimal_closing" : "typography",
            generatedVisualNeeded: false,
            reusableOnThreads: false,
            visualIntent: "local typography",
          },
        })),
      }),
    );
    expect(parsed?.meta.cardPlan?.every((c) => c.visual?.generatedVisualNeeded === false)).toBe(true);
  });

  it("F. unsafe human depiction → architecture alternate stays evidence-safe (no documentary village claim)", () => {
    const parsed = parseInstagramJson(daoInstagramHybridJson());
    const intents = (parsed?.meta.cardPlan ?? [])
      .map((c) => c.visual?.visualIntent ?? "")
      .join(" ");
    expect(intents).not.toMatch(/특정 마을|authentic daily life|의식 장면/);
    expect(intents.toLowerCase()).toMatch(/architectural|nhà trình tường|mountain|border/);
  });

  it("I. parser preserves explicit true", () => {
    const parsed = parseInstagramJson(daoInstagramHybridJson());
    expect(parsed?.meta.cardPlan?.[0]?.visual?.generatedVisualNeeded).toBe(true);
  });

  it("J. parser preserves explicit false (and string false)", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({
        hook: "훅입니다. 더 보기 전에 이유를 줍니다.",
        body: `${"가".repeat(90)}\n\n#여행 #문화 #시야`,
        hashtags: ["#여행", "#문화", "#시야"],
        cta: null,
        altText: "a",
        aspectRatio: "4:5",
        slideHeadlines: ["1", "2", "3", "4"],
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "1",
            body: "",
            visualIntent: "x",
            visual: {
              visualId: "social_visual_01",
              visualMode: "editorial_photo",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "x",
            },
          },
          {
            cardId: "card-02",
            role: "information",
            headline: "2",
            body: "",
            visualIntent: "y",
            visual: {
              visualId: "social_visual_02",
              visualMode: "typography",
              generatedVisualNeeded: "false",
              reusableOnThreads: "false",
              visualIntent: "y",
            },
          },
          {
            cardId: "card-03",
            role: "information",
            headline: "3",
            body: "",
            visualIntent: "z",
            visual: {
              visualId: "social_visual_03",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "z",
            },
          },
          {
            cardId: "card-04",
            role: "cta",
            headline: "4",
            body: "",
            visualIntent: "c",
            visual: {
              visualId: "social_visual_04",
              visualMode: "minimal_closing",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "c",
            },
          },
        ],
      }),
    );
    expect(parsed?.meta.cardPlan?.[0]?.visual?.generatedVisualNeeded).toBe(false);
    expect(parsed?.meta.cardPlan?.[1]?.visual?.generatedVisualNeeded).toBe(false);
  });

  it("compose stores hybrid visual flags from Worker JSON", async () => {
    const content = await composeInstagramPublishableContent({
      composerInput: {
        candidateId: "cmc_dao",
        businessDateKst: "2026-09-18",
        topic: "북부 베트남",
        audience: "여행자",
        commercialIntent: "informational",
        hookHint: null,
        keyMessage: "시야 확장",
        destinations: ["베트남"],
        entities: ["Dao", "nhà trình tường"],
        usableFacts: [],
        avoidedStatements: [],
        unsupportedClaims: [],
        governanceDecision: "allow",
        sourceRevision: "rev1",
        evidenceRefIds: [],
        research: null,
        targetChannels: ["instagram"],
        contentProposition: {
          contract: "content-proposition-v1",
          primaryAudience: "여행자",
          audienceProblem: "휴양지만 앎",
          audienceTension: "북부 맥락 부재",
          contentPromise: "시야 확장",
          readerGain: "다른 베트남을 본다",
          specificTakeaways: ["북부 산악", "시야"],
          desiredAudienceAction: "save",
          engagementMechanism: "curiosity",
          propositionStrength: "strong",
          ctaIntent: null,
          limitations: ["현장 미확인"],
          forbiddenClaims: [],
        } as never,
        approvedCanonicalAsset: {
          contract: "canonical-marketing-asset-v1",
          assetId: "asset_dao",
          status: "approved",
          version: 2,
          approvedVersion: 2,
          titleKo: "또 다른 베트남",
          bodyKo: "본문",
          editorialArchetype: "discovery",
        } as never,
        storyLock: {
          role: "STORY_LOCK_READ_ONLY",
          storyPointId: "sp",
          storyPointHash: "h",
          storyTitleKo: "또 다른 베트남",
          storyQuestionKo: "?",
          audienceProblemKo: "휴양지만",
          decisionAtStakeKo: null,
          audienceTensionKo: "시야",
          readerPayoffKo: "확장",
          editorialArchetype: "discovery",
        },
        compositionMode: "approved_asset_adapter",
      },
      invoke: async () => daoInstagramHybridJson(),
    });
    const needed = (content.instagramMeta?.cardPlan ?? []).filter(
      (c) => c.visual?.generatedVisualNeeded,
    );
    expect(content.publishableSuccess).toBe(true);
    expect(needed.length).toBeGreaterThanOrEqual(2);
    expect(needed.length).toBeLessThanOrEqual(3);
  });
});

describe("Visual planning semantics — Threads mediaPlan", () => {
  it("G. visually strong discovery → mediaPlan recommended 1–3", async () => {
    const content = await composeThreadsPublishableContent({
      composerInput: {
        candidateId: "cmc_dao",
        businessDateKst: "2026-09-18",
        topic: "북부 베트남",
        audience: "여행자",
        commercialIntent: "informational",
        hookHint: null,
        keyMessage: "시야",
        destinations: ["베트남"],
        entities: [],
        usableFacts: [],
        avoidedStatements: [],
        unsupportedClaims: [],
        governanceDecision: "allow",
        sourceRevision: "rev1",
        evidenceRefIds: [],
        research: null,
        targetChannels: ["threads"],
        contentProposition: {
          contract: "content-proposition-v1",
          primaryAudience: "여행자",
          audienceProblem: "휴양지",
          audienceTension: "북부",
          contentPromise: "시야",
          readerGain: "확장",
          specificTakeaways: ["북부 국경", "흙다짐"],
          desiredAudienceAction: "comment",
          engagementMechanism: "curiosity",
          propositionStrength: "strong",
          ctaIntent: null,
          limitations: [],
          forbiddenClaims: [],
        } as never,
        approvedCanonicalAsset: {
          contract: "canonical-marketing-asset-v1",
          assetId: "asset_dao",
          status: "approved",
          version: 2,
          approvedVersion: 2,
          titleKo: "제목",
          bodyKo: "본문",
          editorialArchetype: "discovery",
        } as never,
        storyLock: {
          role: "STORY_LOCK_READ_ONLY",
          storyPointId: "sp",
          storyPointHash: "h",
          storyTitleKo: "t",
          storyQuestionKo: "q",
          audienceProblemKo: "p",
          decisionAtStakeKo: null,
          audienceTensionKo: "t",
          readerPayoffKo: "r",
          editorialArchetype: "discovery",
        },
        compositionMode: "approved_asset_adapter",
      },
      invoke: async () => daoThreadsMediaJson(),
    });
    expect(content.publishableSuccess).toBe(true);
    expect(content.mediaPlan).not.toBeNull();
    expect(content.mediaPlan?.recommended).toBe(true);
    expect(content.mediaPlan!.imageCount).toBeGreaterThanOrEqual(1);
    expect(content.mediaPlan!.imageCount).toBeLessThanOrEqual(3);
  });

  it("H. text-only story → mediaPlan may be null or recommended=false", () => {
    const parsed = parseThreadsJson(
      JSON.stringify({
        title: null,
        body: "짧은 관찰 한 줄.\n\n오늘은 체크리스트 없이 메모만 남깁니다.",
        mediaPlan: null,
      }),
    );
    expect(parsed?.mediaPlan).toBeNull();

    const empty = parseThreadsJson(
      JSON.stringify({
        title: null,
        body: "짧은 관찰 한 줄.\n\n텍스트만으로 충분합니다.",
        mediaPlan: {
          recommended: false,
          assetFamily: "social_static",
          imageCount: 0,
          visuals: [],
        },
      }),
    );
    expect(empty?.mediaPlan?.recommended).toBe(false);
    expect(empty?.mediaPlan?.imageCount).toBe(0);
  });
});

describe("Visual planning semantics — end-to-end derived artifacts", () => {
  it("K. hybrid IG+Threads requests → SharedVisualPlan needed + Astra handoff visualCount > 0", () => {
    const ig = parseInstagramJson(daoInstagramHybridJson())!;
    const th = parseThreadsJson(daoThreadsMediaJson())!;
    const threads = channelBase("threads", "threads_text", th.body);
    threads.mediaPlan = th.mediaPlan;
    const instagram = channelBase("instagram", "instagram_caption", ig.body);
    instagram.instagramMeta = ig.meta;

    const bundle: PublishableContentBundle = {
      contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
      candidateId: "cmc_dao",
      businessDateKst: "2026-09-18",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceRevision: "rev1",
      targetChannels: ["threads", "instagram"],
      sourceAssetId: "asset_dao",
      sourceAssetVersion: 2,
      threads,
      shortform: channelBase("shortform", "short_video_narration", "나레이션"),
      instagram,
    };

    const plan = buildSharedVisualPlan({ bundle });
    const needed = plan.visuals.filter((v) => v.generatedVisualNeeded);
    expect(needed.length).toBeGreaterThan(0);

    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan,
      approvedAssetContext: {
        titleKo: "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남",
        editorialArchetype: "discovery",
        supportedClaimBoundaryKo: "공개 기록 범위",
        limitationsKo: ["세부 마을 미확인"],
        forbiddenClaimsKo: [],
        storySupportVerdict: "SUPPORTED_WITH_LIMITS",
      },
    });
    expect(handoff.visualCount).toBeGreaterThan(0);
    expect(handoff.visualCount).toBe(needed.length);
  });
});
