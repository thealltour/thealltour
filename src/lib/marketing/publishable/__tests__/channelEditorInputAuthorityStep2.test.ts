import { describe, expect, it } from "vitest";

import { ASSET_SOURCE_WRITER_ROLE, CANONICAL_MARKETING_ASSET_CONTRACT } from "@/lib/marketing/canonicalAsset/contracts";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildChannelComposerInputJson,
  buildChannelComposerPromptParts,
  channelComposerRules,
} from "@/lib/marketing/publishable/composerRuntime";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { naverBlogWritingContract } from "@/lib/marketing/publishable/naver_blog/writingContract";
import { naverBandWritingContract } from "@/lib/marketing/publishable/naver_band/writingContract";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";

const STORY_QUESTION =
  "프리미어 빌리지의 독립적인 입지가 내가 실제로 계획한 관광·식사 동선과 리조트 체류 방식에 맞는가?";

function phuQuocProposition(): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "푸꾸옥 리조트 체류를 고민하는 한국인 여행자",
    audienceProblem:
      "독립 입지 리조트를 고르면 관광·식사 동선과 체류 방식이 맞는지 판단하기 어렵다.",
    audienceTension: "리조트 중심 휴식 vs 외부 관광·식사 경험",
    whyNow: "호텔 공급이 늘고 있어 가격이 더 내려갈 수 있다는 관측이 있다",
    contentPromise: "여행 동선과 리조트 체류 시간을 기준으로 입지 적합성을 점검할 수 있다.",
    readerGain: "관광·식사 계획 + 리조트 체류 시간으로 리조트 적합성을 스스로 평가",
    specificTakeaways: [
      "외부 관광·식사 비중이 크면 독립 입지의 이동 비용을 먼저 본다",
      "리조트 내 체류 비중이 크면 입지 독립성이 장점이 될 수 있다",
    ],
    proofRequirements: [],
    contentGapUsed: "공식 이동 시간·셔틀 정보는 확인되지 않음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "compare",
    angle: "호텔 늘어나는 푸꾸옥, 지금 예약할까 더 기다릴까",
    keyMessage: "호텔 늘어나는 푸꾸옥, 지금 잡을까 더 기다릴까",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: ["social_or_community_evidence_only"],
    channelIntentHints: null,
    storyPointRef: {
      storyPointId: "sp_phuquoc_location_fit",
      storyPointHash: "hash_phuquoc_location_fit",
    },
    storyPointHash: "hash_phuquoc_location_fit",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundaryUsed: STORY_QUESTION,
    propositionSourceRevision: "prop_phuquoc_1",
  };
}

function approvedLocationFitAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_phuquoc_location_fit",
    version: 2,
    status: "approved",
    agendaId: "ag_phuquoc",
    storyPointId: "sp_phuquoc_location_fit",
    storyPointHash: "hash_phuquoc_location_fit",
    evidenceBriefRef: "ebr_phuquoc",
    evidenceRevision: "ev_rev_1",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_rev_1",
    sourceRevision: "src_phuquoc_location_fit",
    titleKo: "프리미어 빌리지 입지, 내 관광·식사 동선과 맞을까",
    dekKo: "독립 입지 리조트와 외부 동선 적합성을 가르는 판단 기준",
    openingHookKo:
      "마음에 드는 리조트를 찾았는데, 관광·식사 계획이 많다면 독립 입지가 오히려 부담이 될 수 있습니다.",
    bodyKo:
      "리조트 중심 휴식을 원한다면 독립 입지가 장점이 될 수 있습니다. 반대로 외부 관광·식사 비중이 크다면 이동 부담을 먼저 확인하는 편이 현실적입니다. 가격 하락 여부를 맞히기보다, 내 동선과 체류 방식에 맞는지가 핵심입니다.",
    keyTakeawaysKo: [
      "외부 관광·식사 비중이 크면 독립 입지 이동 비용을 점검한다",
      "리조트 체류 비중이 크면 입지 독립성이 장점이 될 수 있다",
    ],
    decisionGuidanceKo:
      "관광·식사 계획과 리조트 체류 시간을 기준으로 입지 적합성을 판단하세요.",
    optionalCtaIntentKo: "내 일정 기준으로 리조트 입지 적합성을 점검해 보세요",
    evidenceRefs: [{ evidenceId: "ev_loc_1", noteKo: "입지·체류 관찰" }],
    limitationsKo: ["개별 셔틀·이동 시간은 공식 확인 필요"],
    forbiddenClaimsKo: [
      "신규 호텔 개장으로 인한 구체적인 객실 가격 하락률 확정",
      "증거 범위를 벗어난 미래 숙박 요금 예측",
    ],
    supportedClaimBoundaryKo: STORY_QUESTION,
    unresolvedQuestionsKo: [],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    generatedAt: "2026-09-16T00:00:00.000Z",
    editedAt: "2026-09-16T01:00:00.000Z",
    approvedAt: "2026-09-16T02:00:00.000Z",
    approvedVersion: 2,
    humanEdited: true,
    approvalSource: "human_edited",
    approvedBy: "tester",
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
  };
}

function candidateWithDriftSignals(asset: CanonicalMarketingAsset | null): CompletedMarketingCandidate {
  return {
    candidateId: "cmc_phuquoc_step2",
    businessDateKst: "2026-09-16",
    logicalRunKey: "lrk_phuquoc",
    runId: "run_phuquoc",
    status: "needs_human_review",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
    contract: "completed-marketing-candidate-v1",
    contentAssignment: {
      topic: "호텔 쏟아지는 푸꾸옥, 공급 증가와 예약 타이밍",
      audience: "해외여행 예정자",
      commercialIntent: "informational",
      facts: [
        {
          factId: "f1",
          statement:
            "2027년 APEC을 앞두고 푸꾸옥 호텔 공급과 리조트 경쟁이 늘어나고 있다는 관찰이 있다.",
          confidence: "medium",
          evidenceRefs: ["ev_supply"],
        },
      ],
    },
    contentPlan: {
      keyMessage: "호텔 늘어나는 푸꾸옥, 지금 잡을까 더 기다릴까",
      hook: "가격이 더 내려갈까?",
      targetChannels: ["threads", "naver_blog", "naver_band", "kakao_channel", "shortform"],
      factsToAvoid: [],
      proposition: phuQuocProposition(),
      primaryAngle: "booking timing vs waiting for promotions",
      targetAudience: "푸꾸옥 여행 예정자",
    },
    selectedAgenda: {
      title: "푸꾸옥 호텔 공급 증가",
      destinations: ["푸꾸옥"],
      entities: ["프리미어 빌리지"],
      summary: "공급이 늘면 가격 경쟁이 생길 수 있다",
      timelinessNote: "호텔 공급 증가 시점 — 지금 예약 vs 관망",
    },
    governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
    draft: { title: "t", body: "b", channel: "threads" },
    canonicalMarketingAsset: asset,
  } as unknown as CompletedMarketingCandidate;
}

describe("CHANNEL_EDITOR_PROFILE_SPLIT_STEP_2 input authority", () => {
  it("approved-asset mode strips competing creative drivers", () => {
    const asset = approvedLocationFitAsset();
    const composer = buildPublishableComposerInput(candidateWithDriftSignals(asset), {
      approvedCanonicalAsset: asset,
    });
    expect(composer.compositionMode).toBe("approved_asset_adapter");
    expect(composer.topic).toBe(asset.titleKo);
    expect(composer.hookHint).toBe(asset.openingHookKo);
    expect(composer.keyMessage).toBe(asset.titleKo);
    expect(composer.usableFacts).toEqual([]);
    expect(composer.destinations).toEqual([]);

    const json = buildChannelComposerInputJson(composer);
    expect(json.compositionMode).toBe("approved_asset_adapter");
    expect(json.inputAuthorityVersion).toBe(CHANNEL_INPUT_AUTHORITY_VERSION);

    const prop = json.contentProposition as Record<string, unknown>;
    expect(prop.role).toBe("CONSISTENCY_LOCK");
    expect(prop.angle).toBeUndefined();
    expect(prop.whyNow).toBeUndefined();
    expect(prop.keyMessage).toBeUndefined();
    expect(prop.contentGapUsed).toBeUndefined();
    expect(prop.proofRequirements).toBeUndefined();
    expect(prop.propositionStrength).toBeUndefined();
    expect(prop.channelIntentHints).toBeUndefined();
    expect(prop.commercialIntent).toBeUndefined();
    expect(prop.engagementMechanism).toBeUndefined();

    expect(json).not.toHaveProperty("usableFacts");
    expect(json).not.toHaveProperty("destinations");
    expect(json).not.toHaveProperty("research");
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("selectedAgenda");
    expect(serialized).not.toContain("timelinessNote");
    expect(serialized).not.toContain("호텔 늘어나는 푸꾸옥, 지금 잡을까");
    expect(serialized).not.toContain("가격이 더 내려갈까");
    expect(serialized).not.toContain("searchIntent");
    expect(serialized).not.toContain("selectedAngle");
    expect(serialized).toContain(asset.titleKo);
    expect(serialized).toContain(asset.bodyKo.slice(0, 40));
  });

  it("approved-asset mode includes Story lock + asset authority fields", () => {
    const asset = approvedLocationFitAsset();
    const composer = buildPublishableComposerInput(candidateWithDriftSignals(asset), {
      approvedCanonicalAsset: asset,
    });
    expect(composer.storyLock?.role).toBe("STORY_LOCK_READ_ONLY");
    expect(composer.storyLock?.storyPointId).toBe("sp_phuquoc_location_fit");
    expect(composer.storyLock?.storyPointHash).toBe("hash_phuquoc_location_fit");
    expect(composer.storyLock?.storyQuestionKo).toBe(STORY_QUESTION);
    expect(composer.storyLock?.audienceProblemKo).toMatch(/관광|식사|동선/);
    // decisionAtStake only when decision/practical; discovery-like / unknown keep tension separate.
    if (
      composer.storyLock?.editorialArchetype &&
      /practical|decision|worth_it|tradeoff/i.test(composer.storyLock.editorialArchetype)
    ) {
      expect(composer.storyLock.decisionAtStakeKo).toMatch(/휴식|관광|식사/);
    } else {
      expect(composer.storyLock?.decisionAtStakeKo).toBeNull();
    }
    expect(composer.storyLock?.audienceTensionKo).toMatch(/휴식|관광|식사/);
    expect(composer.storyLock?.readerPayoffKo).toBeTruthy();
    expect(composer.storyLock).toHaveProperty("editorialArchetype");

    const json = buildChannelComposerInputJson(composer);
    const assetSlice = json.approvedCanonicalAsset as Record<string, unknown>;
    expect(assetSlice.assetId).toBe(asset.assetId);
    expect(assetSlice.approvedVersion).toBe(2);
    expect(assetSlice.sourceRevision).toBe(asset.sourceRevision);
    expect(assetSlice.titleKo).toBe(asset.titleKo);
    expect(assetSlice.openingHookKo).toBe(asset.openingHookKo);
    expect(assetSlice.bodyKo).toBe(asset.bodyKo);
    expect(assetSlice.keyTakeawaysKo).toEqual(asset.keyTakeawaysKo);
    expect(assetSlice.decisionGuidanceKo).toBe(asset.decisionGuidanceKo);
    expect(assetSlice.limitationsKo).toEqual(asset.limitationsKo);
    expect(assetSlice.forbiddenClaimsKo).toEqual(asset.forbiddenClaimsKo);
    expect(assetSlice.supportedClaimBoundaryKo).toBe(STORY_QUESTION);

    const lock = json.storyLock as Record<string, unknown>;
    expect(lock.storyPointId).toBe("sp_phuquoc_location_fit");
    expect(lock.storyPointHash).toBe("hash_phuquoc_location_fit");
  });

  it("Phu Quoc regression: booking-timing / future-price angles cannot override Story lock inputs", () => {
    const asset = approvedLocationFitAsset();
    const parts = buildChannelComposerPromptParts({
      channel: "threads",
      writingContract: THREADS_WRITING_CONTRACT,
      composerInput: buildPublishableComposerInput(candidateWithDriftSignals(asset), {
        approvedCanonicalAsset: asset,
      }),
    });
    expect(parts.text).toContain("STORY_LOCK_READ_ONLY");
    expect(parts.text).toContain("APPROVED_ASSET_AUTHORITY");
    expect(parts.text).toContain(asset.titleKo);
    expect(parts.text).not.toContain("호텔 늘어나는 푸꾸옥, 지금 잡을까 더 기다릴까");
    expect(parts.text).not.toContain("가격이 더 내려갈까?");
    expect(parts.text).not.toContain("공급이 늘면 가격 경쟁");
    expect(channelComposerRules(
      buildPublishableComposerInput(candidateWithDriftSignals(asset), {
        approvedCanonicalAsset: asset,
      }),
    )).toMatch(/booking-timing|future-price/i);
  });

  it("channel contracts remain Story-first in approved mode", () => {
    expect(naverBlogWritingContract({ hasApprovedCanonicalAsset: true })).toMatch(
      /Approved Story first/i,
    );
    expect(naverBlogWritingContract({ hasApprovedCanonicalAsset: true })).not.toMatch(
      /Search intent first/i,
    );
    expect(naverBandWritingContract({ hasApprovedCanonicalAsset: true })).toMatch(
      /Do NOT use selected angle/i,
    );
    expect(kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true })).toMatch(
      /Do NOT choose a new angle/i,
    );
    expect(THREADS_WRITING_CONTRACT).toMatch(/Channel Adapter/i);
    expect(THREADS_WRITING_CONTRACT).toMatch(/editorialArchetype|approved Canonical/i);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/Story를 바꾸지/);
  });

  it("legacy mode still exposes proposition angle when no approved asset", () => {
    const composer = buildPublishableComposerInput(candidateWithDriftSignals(null));
    expect(composer.compositionMode).toBe("legacy_proposition_driven");
    const json = buildChannelComposerInputJson(composer);
    const prop = json.contentProposition as Record<string, unknown>;
    expect(prop.angle).toBeTruthy();
    expect(json.usableFacts).toBeTruthy();
  });
});
