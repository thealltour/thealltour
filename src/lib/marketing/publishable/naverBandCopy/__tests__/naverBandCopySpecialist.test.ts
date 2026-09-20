/**
 * Naver Band Copy Specialist — authority, style, evidence safety, lifecycle.
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
import { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
import {
  NAVER_BAND_COPY_CONTRACT,
  NAVER_BAND_COPY_SPECIALIST_MAX_CHARS,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import {
  hasForcedNaverBandCta,
  hasNaverBandUnsafeGeneralization,
  looksLikeCanonicalReprint,
  materializeNaverBandCopy,
} from "@/lib/marketing/publishable/naverBandCopy/materialize";
import { runNaverBandCopySpecialist } from "@/lib/marketing/publishable/naverBandCopy/pipeline";

function approvedAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_band_copy",
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
      "베트남 관광청 원문을 바탕으로 한 기록에는 북부 국경지대의 Dao족과 nhà trình tường이라 불리는 전통 흙다짐 주택이 등장합니다. 해변 휴양이나 대도시 중심의 여행에서 접하는 풍경과 다른 문화적 맥락입니다. 흥미로운 지점은 특정 마을 하나의 특별함보다, 베트남을 바라보는 시선 자체가 넓어진다는 데 있습니다. 익숙한 휴양지와 도시만으로 베트남을 이해했다면, 북부 산악 지역의 생활문화와 전통 건축은 같은 나라 안에도 서로 다른 여행 경험이 존재한다는 사실을 보여주는 단서가 됩니다. 다만 현재 확인된 자료만으로 세부 마을의 위치나 현장에서 어떤 체험이 가능한지까지 구체적으로 말하기는 어렵습니다. 지금 확인할 수 있는 것은 Dao족과 전통 흙다짐 주택에 관한 공식 기록입니다.",
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
      {
        beatId: "beat_03",
        purpose: "detail",
        message: "Dao족과 nhà trình tường 공식 기록",
        evidenceRefs: ["ev_dao"],
      },
      { beatId: "beat_04", purpose: "payoff", message: "시선이 넓어진다" },
    ],
    sourceCanonicalFingerprint: "fp_band_test",
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
    candidateId: "cmc_band_copy",
    businessDateKst: "2026-09-18",
    topic: asset.titleKo,
    audience: "여행 독자",
    commercialIntent: "informational",
    hookHint: "여러분의 경험을 댓글로 남겨주세요",
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
    targetChannels: ["naver_band"],
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

function goodLlm(title: string) {
  return {
    title,
    body: [
      "다낭·푸꾸옥·호치민·하노이로 익숙한 베트남 말고, 북부 국경지대 기록도 있습니다.",
      "",
      "공식 기록에는 Dao족과 nhà trình tường(전통 흙다짐 주택)이 등장해요. 해변·대도시 이미지와는 다른 생활문화·건축 맥락입니다.",
      "",
      "세부 위치나 현장 체험은 이 자료만으로 단정하기 어렵지만, 같은 나라 안에 다른 결이 있다는 인상은 분명합니다.",
      "",
      "베트남을 휴양지로만 봤다면 꽤 다른 인상일 수 있어요.",
    ].join("\n"),
    selectedNarrativeBeats: ["beat_01", "beat_03", "beat_04"],
    openingIntent: "reframe",
    keyPoints: [
      "혼합 지역 익숙 프레임 → 북부 국경 재구성",
      "Dao족 / nhà trình tường 공식 기록",
      "시선 확장 (현장 단정 없음)",
    ],
    endingIntent: "observation",
    engagementIntent: null,
    evidenceRefs: ["ev_dao"],
  };
}

describe("naverBandCopy", () => {
  it("A. authority: INPUT_JSON and SOUL encode Canonical/Narrative chain", () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const json = buildChannelComposerInputJson(composerInput(asset, plan));
    expect(json.approvedCanonicalAsset).toBeTruthy();
    expect(json.editorialNarrativePlan).toBeTruthy();
    expect(json.editorialAuthority).toMatchObject({
      factualBoundary: "approved_canonical",
      narrativeSequence: "editorial_narrative_plan",
    });
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/Do NOT restate the entire Canonical/i);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/댓글 달아주세요/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/남부/);
  });

  it("B. style/contract: title/body ok; reprint + forced CTA rejected", () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    const copy = materializeNaverBandCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative: plan,
      canonicalBodyKo: asset.bodyKo,
      llm: goodLlm(asset.titleKo),
    });
    expect(copy.contract).toBe(NAVER_BAND_COPY_CONTRACT);
    expect(copy.title).toBeTruthy();
    expect(copy.body.length).toBeLessThanOrEqual(NAVER_BAND_COPY_SPECIALIST_MAX_CHARS);
    expect(copy.body).toMatch(/Dao족|nhà trình tường/i);
    expect(hasForcedNaverBandCta(copy.body)).toBe(false);

    expect(hasForcedNaverBandCta("여러분의 경험을 댓글로 남겨주세요.")).toBe(true);
    expect(() =>
      materializeNaverBandCopy({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceNarrativeFingerprint: narrativeFp,
        narrative: plan,
        canonicalBodyKo: asset.bodyKo,
        llm: {
          ...goodLlm(asset.titleKo),
          body: `${goodLlm(asset.titleKo).body}\n\n여러분의 경험을 댓글로 남겨주세요.`,
        },
      }),
    ).toThrow(/forced_cta|forced engagement/i);

    const reprintBody = [
      asset.openingHookKo,
      "",
      asset.bodyKo.slice(0, 220),
      "",
      asset.bodyKo.slice(220, 440),
      "",
      asset.bodyKo.slice(440, 660),
      "",
      "이어서 방문 가능한 지역을 확인해보세요.",
    ].join("\n");
    expect(
      looksLikeCanonicalReprint({ body: reprintBody, canonicalBodyKo: asset.bodyKo }),
    ).toBe(true);
  });

  it("C/D. discovery + evidence safety", () => {
    expect(hasNaverBandUnsafeGeneralization("남부 프레임 밖의 베트남")).toBe(true);
    expect(hasNaverBandUnsafeGeneralization("관광지에선 볼 수 없는 진짜 풍경")).toBe(true);
    const asset = approvedAsset();
    const plan = narrative(asset);
    const copy = materializeNaverBandCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(plan),
      narrative: plan,
      canonicalBodyKo: asset.bodyKo,
      llm: goodLlm(asset.titleKo),
    });
    expect(copy.body).not.toMatch(/체크리스트|이런 분께 추천|A vs B/i);
    expect(copy.body).toMatch(/다낭|푸꾸옥|호치민|하노이/);
    expect(copy.endingIntent).toBe("observation");
  });

  it("E/F/G. lifecycle reuse + fail-closed + publishable assemble", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "band-copy-"));
    const invoke = vi.fn(async () => JSON.stringify(goodLlm(asset.titleKo)));
    try {
      const first = await runNaverBandCopySpecialist({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(first.status).toBe("generated");
      expect(first.content.publishableSuccess).toBe(true);
      expect(first.content.channel).toBe("naver_band");
      expect(readFileSync(join(dir, "context/naver-band-copy.json"), "utf8")).toContain(
        NAVER_BAND_COPY_CONTRACT,
      );

      const second = await runNaverBandCopySpecialist({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(second.status).toBe("reused");
      expect(invoke).toHaveBeenCalledTimes(1);

      const stalePlan = {
        ...plan,
        narrativePromise: `${plan.narrativePromise} (revised)`,
      };
      const third = await runNaverBandCopySpecialist({
        composerInput: composerInput(asset, stalePlan),
        invoke,
        packageRoot: dir,
      });
      expect(third.status).toBe("generated");
      expect(invoke).toHaveBeenCalledTimes(2);

      const failed = await composeNaverBandPublishableContent({
        composerInput: composerInput(asset, plan),
        packageRoot: mkdtempSync(join(tmpdir(), "band-fail-")),
        useNaverBandCopySpecialist: true,
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
