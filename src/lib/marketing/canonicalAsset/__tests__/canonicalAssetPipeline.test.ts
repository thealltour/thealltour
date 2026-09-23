/**
 * CANONICAL_ASSET_PIPELINE — focused contract / validation / approval / versioning tests.
 */
import { describe, expect, it } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  ensureCanonicalMarketingAsset,
  CANONICAL_ASSET_MAX_REPAIRS,
} from "@/lib/marketing/canonicalAsset/ensureCanonicalMarketingAsset";
import {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
  canFeedChannelsFromCanonicalAsset,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import {
  buildCanonicalAssetWriterInput,
  computeCanonicalAssetSourceRevision,
} from "@/lib/marketing/canonicalAsset/revisions";
import {
  isApprovedCanonicalAsset,
  validateCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { parseDurableCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import { buildAssetSourceWriterPrompt } from "@/lib/marketing/canonicalAsset/prompt";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { buildChannelComposerInputJson } from "@/lib/marketing/publishable/composerRuntime";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BANGKOK: StoryContentPoint = {
  contract: STORY_CONTENT_POINT_CONTRACT,
  pointId: "sp_bangkok_hotel_cma",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
  storyClaim: "방콕 가족여행에서 숙소 위치가 호텔 등급만큼 중요할 수 있다",
  whyInteresting: "가족 여행에서 좋은 호텔 직관이 이동 불편으로 자주 깨진다",
  audienceTension: "등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다",
  curiosityGap: "높은 등급이 항상 더 좋다는 직관과 이동 편의가 충돌한다",
  readerPayoff: "부모님 동반 숙소 우선 비교 기준을 얻음",
  mechanisms: ["counter_intuition", "decision_relief"],
  researchNeeded: ["숙박 지역별 BTS 접근성"],
  researchQuestions: ["방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?"],
  genericRisk: "체크리스트 붕괴",
  genericRiskMitigation: "우선순위 1개 고정",
  channelPotential: {
    conversation: "high",
    visualExplainability: "medium",
    searchDepth: "high",
    shortformHookability: "medium",
  },
  nonGoals: ["방콕 호텔 종합 가이드"],
  agendaFitNotes: null,
};

function evidence(verdict: EvidenceBackedStoryBrief["storySupportVerdict"], boundary: string | null = null): EvidenceBackedStoryBrief {
  const hash = createStoryPointHash(BANGKOK);
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: BANGKOK.pointId,
    storyPointHash: hash,
    agendaLogicalIdentity: "logical_bangkok_pipeline",
    researchExecutionStatus: verdict === "SUPPORTED" ? "complete" : "partial",
    storySupportVerdict: verdict,
    supportedClaimBoundary: boundary,
    researchQuestionFindings: [
      {
        question: "방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?",
        status: "answered",
        finding: "수쿰빗·실롬 등 지역별 BTS 접근성 차이가 후기와 안내에서 반복 관측된다",
        evidenceRefs: ["ev1"],
        sourceClasses: ["community"],
        confidence: 0.7,
        limitations: [],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ev1",
        relationship: "supports",
        relevanceToStoryPoint: 0.8,
        epistemicType: "observed_signal",
        sourceClass: "community",
        note: "test",
      },
    ],
    contradictedClaims: ["방콕 전 지역 호텔은 이동이 동일하다"],
    unresolvedQuestions: ["특정 호텔의 확정 조식 가격은?"],
    usableFactIds: ["ev1"],
    refutationNotes: null,
    researchSupportedFraming: ["위치/접근성을 등급과 함께 비교할 근거가 있다"],
    limitations: ["개별 호텔 가격·운항 빈도는 확인하지 않음"],
    alternateFallbackUsed: false,
    observability: {
      plannedQuestionCount: 1,
      answeredQuestionCount: 1,
      unresolvedQuestionCount: 1,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 1,
      externalQueriesSuccessful: 1,
      sourceClasses: ["community"],
    },
  };
}

function proposition(boundary: string | null = null): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부모님 동반 방콕 가족여행 준비자",
    audienceProblem: "등급만 보고 고르면 이동 피로가 커질 수 있다",
    audienceTension: "등급 vs 위치",
    whyNow: "가족여행 숙소 선택 시즌",
    contentPromise: "숙소 위치를 등급과 함께 비교하는 기준을 정리한다",
    readerGain: "부모님 동반 시 무엇을 먼저 볼지 판단 기준을 얻는다",
    specificTakeaways: ["BTS 접근성을 먼저 본다", "이동 피로를 등급과 교환하지 않는다"],
    proofRequirements: [{ claimArea: "접근성", requiredProof: "지역 관측", severity: "must" }],
    contentGapUsed: "등급 추천만 많고 위치 우선 기준이 부족",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "방콕 가족 호텔은 위치가 등급만큼 중요하다",
    keyMessage: "위치부터 비교하라",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: ["개별 요금은 단정하지 않음"],
    storyPointRef: {
      storyPointId: BANGKOK.pointId,
      storyPointHash: createStoryPointHash(BANGKOK),
    },
    storyPointHash: createStoryPointHash(BANGKOK),
    storySupportVerdict: boundary ? "PARTIALLY_SUPPORTED" : "SUPPORTED",
    supportedClaimBoundaryUsed: boundary,
  };
}

function goodKoreanAssetJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    titleKo: "방콕 가족여행, 호텔 등급보다 위치를 먼저 봐야 할까",
    dekKo: "부모님 동반 숙소 선택의 현실 기준",
    openingHookKo:
      "등급만 올리면 편해질 것 같다는 직관이, 실제로는 이동 피로로 하루를 망가뜨리는 경우가 있습니다.",
    bodyKo: [
      "부모님과 방콕을 갈 때 많은 사람이 호텔 등급부터 비교합니다.",
      "하지만 후기와 지역 안내를 보면 수쿰빗·실롬처럼 숙박 지역에 따라 BTS 접근성 차이가 뚜렷합니다.",
      "등급이 높아도 이동이 길면 부모님 동반 일정은 금방 지칩니다.",
      "그래서 이번 원문의 핵심은 등급과 위치를 함께 놓고, 이동 편의를 먼저 확인하라는 판단 기준입니다.",
      "개별 호텔 요금이나 운항 스케줄은 여기서 단정하지 않습니다.",
    ].join("\n\n"),
    keyTakeawaysKo: [
      "숙소 지역별 BTS 접근성부터 비교한다",
      "등급과 이동 피로를 교환하지 않는다",
      "확정 가격·운항은 공식 소스로 확인한다",
    ],
    decisionGuidanceKo:
      "부모님 동반이라면 후보 숙소의 이동 동선을 먼저 적고, 그다음 등급을 비교하세요.",
    optionalCtaIntentKo: "후보 숙소 접근성을 메모해 두기",
    limitationsKo: ["개별 호텔 가격은 확인하지 않음"],
    forbiddenClaimsKo: ["방콕 전 지역 호텔은 이동이 동일하다"],
    supportedClaimBoundaryKo: null,
    unresolvedQuestionsKo: ["특정 호텔의 확정 조식 가격은?"],
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    ...extra,
  });
}

function baseAsset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  const brief = evidence("SUPPORTED");
  const prop = proposition();
  const writer = buildCanonicalAssetWriterInput({
    agendaId: "ag_bangkok",
    storyPoint: BANGKOK,
    storyPointHash: createStoryPointHash(BANGKOK),
    evidenceBrief: brief,
    proposition: prop,
    topicIdentitySummary: "방콕 · 호텔",
  });
  const sourceRevision = computeCanonicalAssetSourceRevision({
    storyPointId: writer.storyPointId,
    storyPointHash: writer.storyPointHash,
    evidenceRevision: writer.evidenceRevision,
    propositionRevision: writer.proposition.propositionRevision,
    supportedClaimBoundary: writer.supportedClaimBoundary,
    editorialArchetype: writer.editorialArchetype,
  });
  const parsed = JSON.parse(goodKoreanAssetJson()) as Record<string, unknown>;
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: `cma_${sourceRevision}`,
    version: 1,
    status: "draft",
    agendaId: "ag_bangkok",
    storyPointId: BANGKOK.pointId,
    storyPointHash: createStoryPointHash(BANGKOK),
    evidenceBriefRef: writer.evidenceBriefRef,
    evidenceRevision: writer.evidenceRevision,
    contentPropositionRef: prop.contract,
    propositionRevision: writer.proposition.propositionRevision,
    sourceRevision,
    titleKo: String(parsed.titleKo),
    dekKo: String(parsed.dekKo),
    openingHookKo: String(parsed.openingHookKo),
    bodyKo: String(parsed.bodyKo),
    keyTakeawaysKo: parsed.keyTakeawaysKo as string[],
    decisionGuidanceKo: String(parsed.decisionGuidanceKo),
    optionalCtaIntentKo: String(parsed.optionalCtaIntentKo),
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    limitationsKo: ["개별 호텔 가격은 확인하지 않음"],
    forbiddenClaimsKo: ["방콕 전 지역 호텔은 이동이 동일하다"],
    supportedClaimBoundaryKo: null,
    unresolvedQuestionsKo: ["특정 호텔의 확정 조식 가격은?"],
    storySupportVerdict: "SUPPORTED",
    generatedAt: "2026-09-15T00:00:00.000Z",
    editedAt: null,
    approvedAt: null,
    approvedVersion: null,
    humanEdited: false,
    approvalSource: null,
    approvedBy: null,
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
    ...overrides,
  };
}

describe("CANONICAL_ASSET_PIPELINE contract", () => {
  it("valid Korean asset with source refs passes", () => {
    const asset = baseAsset();
    const brief = evidence("SUPPORTED");
    const prop = proposition();
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
      expectedSourceRevision: asset.sourceRevision,
    });
    expect(check.ok).toBe(true);
    expect(parseDurableCanonicalMarketingAsset(asset)?.contract).toBe(
      CANONICAL_MARKETING_ASSET_CONTRACT,
    );
  });

  it("rejects story drift and thin English prose", () => {
    const asset = baseAsset({
      storyPointId: "other",
      bodyKo: "This is an English editorial article about travel tips and travelers should book now.",
      titleKo: "English only title about travel",
      openingHookKo: "English hook for travelers",
      decisionGuidanceKo: "Book now because",
    });
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      expectedSourceRevision: asset.sourceRevision,
    });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.code === "story_id_drift")).toBe(true);
  });

  it("rejects contradicted claim revival and unsupported price", () => {
    const asset = baseAsset({
      bodyKo: `${baseAsset().bodyKo}\n\n방콕 전 지역 호텔은 이동이 동일하다. 항공권 899,000원으로 확정 가격이다.`,
    });
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      expectedSourceRevision: asset.sourceRevision,
    });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.code === "contradicted_claim_revived")).toBe(true);
    expect(check.issues.some((i) => i.code === "unsupported_price_or_route")).toBe(true);
  });

  it("PARTIALLY_SUPPORTED keeps boundary; broad claim rejected", () => {
    const boundary = "숙소 위치를 등급과 함께 비교할 근거가 있다";
    const brief = evidence("PARTIALLY_SUPPORTED", boundary);
    const prop = proposition(boundary);
    const writer = buildCanonicalAssetWriterInput({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
      topicIdentitySummary: "방콕",
    });
    const sourceRevision = computeCanonicalAssetSourceRevision({
      storyPointId: writer.storyPointId,
      storyPointHash: writer.storyPointHash,
      evidenceRevision: writer.evidenceRevision,
      propositionRevision: writer.proposition.propositionRevision,
      supportedClaimBoundary: boundary,
      editorialArchetype: writer.editorialArchetype,
    });
    const asset = baseAsset({
      sourceRevision,
      evidenceRevision: writer.evidenceRevision,
      propositionRevision: writer.proposition.propositionRevision,
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundaryKo: boundary,
      bodyKo: `${BANGKOK.storyClaim}\n\n하지만 경계 밖의 넓은 주장만 반복한다.`,
    });
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
      expectedSourceRevision: sourceRevision,
    });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.code === "boundary_violation")).toBe(true);
  });
});

describe("CANONICAL_ASSET_PIPELINE generation + repair", () => {
  it("Asset Source Writer prompt is not Content Strategist", () => {
    const writer = buildCanonicalAssetWriterInput({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      topicIdentitySummary: "방콕",
    });
    const prompt = buildAssetSourceWriterPrompt({ writerInput: writer });
    expect(prompt).toContain(ASSET_SOURCE_WRITER_ROLE);
    expect(prompt).toContain("YOU MUST NOT");
    expect(prompt.toLowerCase()).not.toContain("you are the content strategist");
  });

  it("reuses unchanged asset with 0 LLM calls", async () => {
    const existing = baseAsset({ status: "approved", approvedVersion: 1, approvedAt: "t" });
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      topicIdentitySummary: "방콕",
      existing,
      invoke: async () => {
        throw new Error("should_not_call");
      },
    });
    expect(result.outcome).toBe("reused");
    expect(result.llmCallCount).toBe(0);
  });

  it("forceRegenerate skips reuse even when sourceRevision matches", async () => {
    const existing = baseAsset({ status: "draft" });
    let calls = 0;
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      topicIdentitySummary: "방콕",
      existing,
      forceRegenerate: true,
      invoke: async () => {
        calls += 1;
        return goodKoreanAssetJson();
      },
    });
    expect(result.outcome).toBe("generated");
    expect(calls).toBe(1);
    expect(result.llmCallCount).toBe(1);
    expect(result.asset?.titleKo).toContain("방콕");
  });

  it("invalid first then valid repair passes (max 1)", async () => {
    let calls = 0;
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      topicIdentitySummary: "방콕",
      invoke: async () => {
        calls += 1;
        if (calls === 1) {
          return goodKoreanAssetJson({
            bodyKo: "짧음",
            titleKo: "x",
          });
        }
        return goodKoreanAssetJson();
      },
    });
    expect(CANONICAL_ASSET_MAX_REPAIRS).toBe(1);
    expect(calls).toBe(2);
    expect(result.outcome).toBe("repaired");
    expect(result.asset?.status).toBe("draft");
    expect(result.repairCount).toBe(1);
  });

  it("invalid repair fail-closed — no deterministic fallback", async () => {
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag",
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidence("SUPPORTED"),
      proposition: proposition(),
      topicIdentitySummary: "방콕",
      invoke: async () =>
        goodKoreanAssetJson({
          bodyKo: "짧음",
          titleKo: "x",
          openingHookKo: "짧",
          decisionGuidanceKo: "짧",
        }),
    });
    expect(result.outcome).toBe("validation_failed");
    expect(result.llmCallCount).toBe(2);
    expect(result.asset?.status).toBe("validation_failed");
    expect(canFeedChannelsFromCanonicalAsset(result.asset)).toBe(false);
  });
});

describe("CANONICAL_ASSET_PIPELINE human approval + channels", () => {
  it("draft / human_edited cannot feed channels; approved can", () => {
    const draft = baseAsset();
    expect(canFeedChannelsFromCanonicalAsset(draft)).toBe(false);
    const edited = applyHumanCanonicalAssetEdit({
      asset: draft,
      edits: { bodyKo: `${draft.bodyKo}\n\n사람이 다듬은 문단입니다.` },
    });
    expect(edited.version).toBe(2);
    expect(edited.status).toBe("human_edited");
    expect(canFeedChannelsFromCanonicalAsset(edited)).toBe(false);
    const approved = approveCanonicalMarketingAsset({
      asset: edited,
      mode: "human_edited",
      approvedBy: "tester",
    });
    expect(approved.status).toBe("approved");
    expect(approved.approvedVersion).toBe(2);
    expect(isApprovedCanonicalAsset(approved)).toBe(true);
    expect(canFeedChannelsFromCanonicalAsset(approved)).toBe(true);
  });

  it("channel composer input uses approved asset as SoT and records version", () => {
    const approved = approveCanonicalMarketingAsset({
      asset: baseAsset(),
      mode: "ai_original",
    });
    const candidate = {
      candidateId: "cmc_cma",
      businessDateKst: "2026-09-15",
      contentAssignment: {
        topic: "방콕 호텔",
        audience: "가족",
        commercialIntent: "informational",
        facts: [],
      },
      contentPlan: {
        keyMessage: "위치",
        hook: null,
        targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"],
        proposition: proposition(),
        factsToAvoid: [],
      },
      selectedAgenda: {
        title: "방콕",
        destinations: ["방콕"],
        entities: [],
        summary: "요약",
        timelinessNote: null,
      },
      governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
      draft: { body: "x", title: "y", channel: "threads" },
      canonicalMarketingAsset: approved,
    } as unknown as CompletedMarketingCandidate;

    const input = buildPublishableComposerInput(candidate, {
      approvedCanonicalAsset: approved,
    });
    expect(input.approvedCanonicalAsset?.approvedVersion).toBe(1);
    expect(input.targetChannels).toEqual(
      expect.arrayContaining([
        "threads",
        "shortform",
        "naver_blog",
        "naver_band",
        "kakao_channel",
      ]),
    );
    const json = buildChannelComposerInputJson(input);
    expect(json.approvedCanonicalAsset).toMatchObject({
      assetId: approved.assetId,
      approvedVersion: 1,
    });
    expect(JSON.stringify(json)).toContain(approved.titleKo);
  });
});

describe("CANONICAL_ASSET_PIPELINE hybrid / regression markers", () => {
  it("external-editorial-director path is not a special bypass in asset writer", () => {
    const prompt = buildAssetSourceWriterPrompt({
      writerInput: buildCanonicalAssetWriterInput({
        agendaId: "ag",
        storyPoint: BANGKOK,
        storyPointHash: createStoryPointHash(BANGKOK),
        evidenceBrief: evidence("SUPPORTED"),
        proposition: proposition(),
        topicIdentitySummary: "방콕",
      }),
    });
    expect(prompt).not.toMatch(/external-only|chatgpt bypass|skip asset/i);
    expect(prompt).toContain(ASSET_SOURCE_WRITER_ROLE);
  });

  it("ED-1/2/3 and MQ modules remain present", () => {
    const root = process.cwd();
    for (const rel of [
      "src/lib/marketing/storyPoint/humanStorySelection.ts",
      "src/lib/marketing/storyPoint/ensureStoryTargetedResearch.ts",
      "src/lib/marketing/content/proposition/storyLock.ts",
      "src/lib/marketing/publishable/ensurePublishableContent.ts",
      "src/lib/marketing/value/evaluateMarketingValue.ts",
      "src/lib/marketing/editorialDirector/importExternalStories.ts",
    ]) {
      expect(existsSync(join(root, rel))).toBe(true);
    }
    const publishable = readFileSync(
      join(root, "src/lib/marketing/publishable/ensurePublishableContent.ts"),
      "utf8",
    );
    expect(publishable).toContain("canonical_asset_unapproved");
    expect(publishable).toContain("approvedCanonicalAsset");
  });
});
