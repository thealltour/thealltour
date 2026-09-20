/**
 * Naver Blog Structure Planner + Copy Writer — authority, lifecycle, evidence safety.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { buildChannelComposerInputJson } from "@/lib/marketing/publishable/composerRuntime";
import {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
  type EditorialNarrativePlan,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeNaverBlogPublishableContent } from "@/lib/marketing/publishable/naver_blog/composeNaverBlogPublishableContent";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { buildNaverBlogStructureContentFingerprint } from "@/lib/marketing/publishable/naverBlogEditorial/fingerprint";
import {
  NAVER_BLOG_COPY_WRITER_SOUL,
  NAVER_BLOG_STRUCTURE_PLANNER_SOUL,
} from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import {
  hasNaverBlogForcedCta,
  hasNaverBlogUnsafeGeneralization,
  materializeNaverBlogCopy,
  materializeNaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/materialize";
import { runNaverBlogEditorialPipeline } from "@/lib/marketing/publishable/naverBlogEditorial/pipeline";

function approvedAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_blog_editorial",
    version: 1,
    status: "approved",
    agendaId: "ag_1",
    storyPointId: "sp_1",
    storyPointHash: "hash_1",
    evidenceBriefRef: null,
    evidenceRevision: "ev_1",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_1",
    sourceRevision: "src_1",
    titleKo: "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남",
    dekKo: null,
    openingHookKo:
      "다낭의 해변, 푸꾸옥의 리조트, 호치민과 하노이의 도시 풍경. 한국 여행자에게 익숙한 베트남의 모습입니다.",
    bodyKo:
      "베트남 관광청 원문을 바탕으로 한 기록에는 북부 국경지대의 Dao족과 nhà trình tường이라 불리는 전통 흙다짐 주택이 등장합니다. 해변 휴양이나 대도시 중심의 여행에서 접하는 풍경과 다른 문화적 맥락입니다. 세부 마을 위치나 현장 체험은 현재 자료만으로 말하기 어렵습니다.",
    keyTakeawaysKo: [
      "북부 국경지대 Dao족 생활문화 기록이 존재한다",
      "nhà trình tường는 익숙한 해변·도시 이미지와 다른 건축적 맥락을 보여준다",
    ],
    decisionGuidanceKo: "휴양·대도시 기대와 산악 국경 맥락을 구분해서 본다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev_dao", noteKo: "공식 기록" }],
    limitationsKo: ["세부 마을 위치 및 현장 체험 요소는 공식 기록 범위 내"],
    forbiddenClaimsKo: ["꼭 가봐야 할", "현지인의 진짜 삶"],
    supportedClaimBoundaryKo: "공식 기록 범위 안에서만 서술",
    unresolvedQuestionsKo: [],
    storySupportVerdict: "SUPPORTED",
    generatedAt: "2026-09-18T00:00:00.000Z",
    editedAt: null,
    approvedAt: "2026-09-18T01:00:00.000Z",
    approvedVersion: 1,
    humanEdited: false,
    approvalSource: "ai_original",
    approvedBy: "test",
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
    editorialArchetype: "discovery",
  };
}

function narrative(asset: CanonicalMarketingAsset): EditorialNarrativePlan {
  return {
    contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    assetId: asset.assetId,
    assetVersion: asset.version,
    editorialArchetype: "discovery",
    narrativePromise: "익숙한 휴양·도시 프레임을 북부 국경 Dao족·흙다짐 주택으로 재구성한다",
    audienceTakeaway: "같은 나라 안에도 다른 여행 맥락이 있다",
    beats: [
      { beatId: "beat_01", purpose: "hook", message: "익숙한 해변·도시 이미지를 떠올린다" },
      { beatId: "beat_02", purpose: "reframe", message: "북부 국경지대로 시선을 옮긴다" },
      { beatId: "beat_03", purpose: "context", message: "Dao족 관련 공식 기록" },
      {
        beatId: "beat_04",
        purpose: "detail",
        message: "nhà trình tường 건축적 맥락",
        evidenceRefs: ["ev_dao"],
      },
      { beatId: "beat_05", purpose: "contrast", message: "익숙한 이미지와 어떻게 다른가" },
      { beatId: "beat_06", purpose: "closing", message: "확인 가능한 것과 불가능한 것" },
      { beatId: "beat_07", purpose: "payoff", message: "시선이 넓어진다" },
    ],
    sourceCanonicalFingerprint: "fp_blog_test",
    provenance: {
      sourceAssetId: asset.assetId,
      sourceVersion: asset.version,
      modelProfile: "editorial-narrative-planner",
      generatedAt: "2026-09-18T01:00:00.000Z",
    },
  };
}

function composerInput(
  asset: CanonicalMarketingAsset,
  plan: EditorialNarrativePlan,
): PublishableComposerInput {
  return {
    candidateId: "cmc_blog_editorial",
    businessDateKst: "2026-09-18",
    topic: asset.titleKo,
    audience: "여행 독자",
    commercialIntent: "informational",
    hookHint: "저장해두고 비교해보세요",
    keyMessage: asset.titleKo,
    destinations: [],
    entities: [],
    usableFacts: [
      {
        statement: "공식 기록에 Dao족과 nhà trình tường가 등장한다",
        confidence: "high",
        evidenceRefIds: ["ev_dao"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: ["현장 체험 확정"],
    governanceDecision: "ALLOW",
    sourceRevision: "src_1",
    evidenceRefIds: ["ev_dao"],
    research: null,
    targetChannels: ["naver_blog"],
    approvedCanonicalAsset: asset,
    editorialNarrativePlan: plan,
    compositionMode: "approved_asset_adapter",
    storyLock: {
      role: "STORY_LOCK_READ_ONLY",
      storyPointId: "sp_1",
      storyPointHash: "hash_1",
      storyTitleKo: asset.titleKo,
      storyQuestionKo: null,
      audienceProblemKo: null,
      decisionAtStakeKo: null,
      audienceTensionKo: null,
      readerPayoffKo: null,
      editorialArchetype: "discovery",
    },
  };
}

function structureLlm() {
  return {
    titleStrategy: "curiosity reframe without checklist",
    selectedTitle: "해변·리조트·대도시로만 알았다면, 북부 국경지대 Dao족 기록이 보여주는 다른 베트남",
    titleCandidates: [
      "해변·리조트·대도시로만 알았다면, 북부 국경지대 Dao족 기록이 보여주는 다른 베트남",
      "다낭·푸꾸옥·호치민·하노이 너머, 북부 국경지대에서 읽히는 생활문화",
      "nhà trình tường와 Dao족 기록으로 보는 베트남의 다른 맥락",
    ],
    sectionPlan: [
      {
        sectionId: "sec_01",
        purpose: "opening",
        heading: "익숙한 베트남 이미지를 잠시 내려놓기",
        narrativeBeatRefs: ["beat_01"],
        evidenceRefs: [],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_02",
        purpose: "context",
        heading: "북부 국경지대로 시선이 옮겨질 때",
        narrativeBeatRefs: ["beat_02"],
        evidenceRefs: [],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_03",
        purpose: "evidence",
        heading: "Dao족 관련 공식 기록이 말하는 것",
        narrativeBeatRefs: ["beat_03"],
        evidenceRefs: ["ev_dao"],
        targetDepth: "deep",
      },
      {
        sectionId: "sec_04",
        purpose: "detail",
        heading: "nhà trình tường의 건축적 맥락",
        narrativeBeatRefs: ["beat_04"],
        evidenceRefs: ["ev_dao"],
        targetDepth: "deep",
      },
      {
        sectionId: "sec_05",
        purpose: "contrast",
        heading: "익숙한 해변·대도시 이미지와 어떻게 다른가",
        narrativeBeatRefs: ["beat_05"],
        evidenceRefs: [],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_06",
        purpose: "limitation",
        heading: "현재 자료로 확인 가능한 것 / 확인 불가능한 것",
        narrativeBeatRefs: ["beat_06"],
        evidenceRefs: [],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_07",
        purpose: "closing",
        heading: "시선이 넓어지는 지점",
        narrativeBeatRefs: ["beat_07"],
        evidenceRefs: [],
        targetDepth: "brief",
      },
    ],
    openingIntent: "familiar mixed-region frame then northern border reframe",
    conclusionIntent: "perspective expansion with evidence limitation",
    ctaIntent: null,
    faqPlan: [],
    searchIntent: "베트남 북부 국경 Dao족 nhà trình tường",
    primaryTopic: "베트남 북부 국경지대 Dao족과 전통 흙다짐 주택",
    evidenceCoverage: "공식 기록 범위; 현장 체험/세부 위치는 제한",
  };
}

function copyLlm(structureTitle: string) {
  const sections = [
    ["sec_01", "익숙한 베트남 이미지를 잠시 내려놓기", "다낭의 해변, 푸꾸옥의 리조트, 호치민과 하노이의 도시 풍경은 한국 여행자에게 익숙한 베트남 이미지입니다. 그 프레임만으로도 충분히 매력적이지만, 기록이 가리키는 다른 맥락도 있습니다."],
    ["sec_02", "북부 국경지대로 시선이 옮겨질 때", "시선을 북부 국경지대로 옮기면 이야기가 달라집니다. 같은 나라 안에서도 지역 맥락이 달라질 수 있다는 점이 출발점입니다."],
    ["sec_03", "Dao족 관련 공식 기록이 말하는 것", "공식 기록에는 북부 국경지대 Dao족과 관련된 생활문화 서술이 등장합니다. 여기서 중요한 것은 특정 마을을 확정하는 것이 아니라, 기록이 보여주는 문화적 면모입니다."],
    ["sec_04", "nhà trình tường의 건축적 맥락", "‘nhà trình tường’라 불리는 전통 흙다짐 주택은 익숙한 해변·도시 중심의 이미지와 다른 건축적 맥락을 보여줍니다. 재료와 형태 자체가 다른 생활 환경을 암시합니다."],
    ["sec_05", "익숙한 해변·대도시 이미지와 어떻게 다른가", "휴양지와 대도시 중심의 여행 경험과, 북부 국경지대 기록이 제시하는 생활문화·건축 맥락은 겹치지 않는 부분이 있습니다. 비교의 목적은 우열이 아니라 시야를 넓히는 데 있습니다."],
    ["sec_06", "현재 자료로 확인 가능한 것 / 확인 불가능한 것", "현재 확인된 것은 공식 기록에 등장하는 Dao족과 nhà trình tường 관련 서술입니다. 세부 마을 위치나 현장 체험 가능성은 별도 확인이 필요하며, 이 글에서는 단정하지 않습니다."],
    ["sec_07", "시선이 넓어지는 지점", "익숙한 휴양·도시 이미지만으로 베트남을 이해했다면, 북부 국경지대 기록은 같은 나라 안에 다른 여행 경험이 존재할 수 있다는 단서가 됩니다."],
  ] as const;

  const bodyParts = [`# ${structureTitle}`, ""];
  const sectionOutputs = sections.map(([sectionId, heading, body]) => {
    bodyParts.push(`## ${heading}`, "", body, "");
    return { sectionId, heading, bodyMarkdown: body };
  });

  return {
    title: structureTitle,
    bodyMarkdown: bodyParts.join("\n"),
    sectionOutputs,
    faq: [],
    cta: null,
    evidenceRefs: ["ev_dao"],
  };
}

describe("naverBlogEditorial", () => {
  it("A. authority: INPUT_JSON and SOUL encode Canonical/Narrative/Structure chain", () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const json = buildChannelComposerInputJson(composerInput(asset, plan));
    expect(json.approvedCanonicalAsset).toBeTruthy();
    expect(json.editorialNarrativePlan).toBeTruthy();
    expect(json.editorialAuthority).toMatchObject({
      factualBoundary: "approved_canonical",
      narrativeSequence: "editorial_narrative_plan",
    });
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Do NOT write the full article body/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/Do not reorder, drop, or invent sections/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/남부 베트남/);
  });

  it("B. role separation: structure has no long body; copy follows section order", () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    expect(() =>
      materializeNaverBlogStructurePlan({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceNarrativeFingerprint: narrativeFp,
        narrative: plan,
        llm: { ...structureLlm(), bodyMarkdown: "x".repeat(500) },
      }),
    ).toThrow(/body/i);

    const structure = materializeNaverBlogStructurePlan({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative: plan,
      llm: structureLlm(),
    });
    expect(structure.contract).toBe(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT);
    expect(structure.sectionPlan.length).toBeGreaterThanOrEqual(5);

    const structureFp = buildNaverBlogStructureContentFingerprint(structure);
    const badOrder = copyLlm(structure.selectedTitle);
    badOrder.sectionOutputs = [...badOrder.sectionOutputs].reverse();
    expect(() =>
      materializeNaverBlogCopy({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceStructureFingerprint: structureFp,
        structure,
        llm: badOrder,
      }),
    ).toThrow(/sectionOutputs order|section_mismatch|section count/i);
  });

  it("C/D/E. discovery + evidence safety + empty FAQ", () => {
    expect(hasNaverBlogUnsafeGeneralization("남부 프레임 밖의 베트남")).toBe(true);
    expect(hasNaverBlogForcedCta("지금 예약하세요")).toBe(true);
    const asset = approvedAsset();
    const plan = narrative(asset);
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    const structure = materializeNaverBlogStructurePlan({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative: plan,
      llm: structureLlm(),
    });
    expect(structure.faqPlan).toEqual([]);
    expect(structure.ctaIntent).toBeNull();
    expect(structure.sectionPlan.some((s) => /체크리스트|추천|A vs B/i.test(s.heading))).toBe(false);

    const copy = materializeNaverBlogCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceStructureFingerprint: buildNaverBlogStructureContentFingerprint(structure),
      structure,
      llm: copyLlm(structure.selectedTitle),
    });
    expect(copy.contract).toBe(NAVER_BLOG_COPY_CONTRACT);
    expect(copy.faq).toEqual([]);
    expect(copy.bodyMarkdown).not.toMatch(/남부\s*프레임|관광 광고가 아니라/);
    expect(copy.bodyMarkdown).toMatch(/다낭|푸꾸옥|호치민|하노이/);
    expect(copy.bodyMarkdown).toMatch(/Dao족|nhà trình tường/i);
  });

  it("F/G/H. lifecycle reuse + fail-closed + publishable assemble", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "blog-editorial-"));
    let stage = 0;
    const invoke = vi.fn(async (prompt: unknown) => {
      const profile = (prompt as { hermesProfile?: string }).hermesProfile ?? "";
      if (profile.includes("structure")) {
        stage += 1;
        return JSON.stringify(structureLlm());
      }
      return JSON.stringify(copyLlm(structureLlm().selectedTitle));
    });
    try {
      const first = await runNaverBlogEditorialPipeline({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(first.status).toBe("generated");
      expect(first.content.publishableSuccess).toBe(true);
      expect(first.content.blogMeta?.sectionPlan.length).toBeGreaterThanOrEqual(5);
      expect(readFileSync(join(dir, "context/naver-blog-structure-plan.json"), "utf8")).toContain(
        NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
      );
      expect(readFileSync(join(dir, "context/naver-blog-copy.json"), "utf8")).toContain(
        NAVER_BLOG_COPY_CONTRACT,
      );

      const second = await runNaverBlogEditorialPipeline({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(second.status).toBe("reused");

      const failed = await composeNaverBlogPublishableContent({
        composerInput: composerInput(asset, plan),
        packageRoot: mkdtempSync(join(tmpdir(), "blog-fail-")),
        useNaverBlogEditorialSplit: true,
        allowDeterministicFallback: true,
        invoke: async () => {
          throw new Error("boom");
        },
      });
      expect(failed.publishableSuccess).toBe(false);
      expect(failed.body).toBe("[generation failed]");
      expect(failed.provenance.composer).toBe("llm");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
