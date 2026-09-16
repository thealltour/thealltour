import { describe, expect, it } from "vitest";

import {
  CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT,
  STALE_ASSET_MESSAGE_KO,
  buildCanonicalAssetChatGptClipboardText,
  buildCanonicalAssetChatGptExportPayload,
  buildKeyEvidenceKo,
  normalizeKeyTakeawaysKo,
  parseCanonicalAssetChatGptImport,
  validateCanonicalAssetChatGptEdits,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import {
  buildCanonicalAssetWriterInput,
  computeCanonicalAssetSourceRevision,
} from "@/lib/marketing/canonicalAsset/revisions";
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

function evidenceBrief(
  verdict: EvidenceBackedStoryBrief["storySupportVerdict"] = "SUPPORTED",
  boundary: string | null = null,
): EvidenceBackedStoryBrief {
  const hash = createStoryPointHash(BANGKOK);
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: BANGKOK.pointId,
    storyPointHash: hash,
    agendaLogicalIdentity: "bangkok_hotel",
    researchExecutionStatus: "complete",
    storySupportVerdict: verdict,
    supportedClaimBoundary: boundary,
    researchQuestionFindings: [
      {
        question: "방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?",
        status: "answered",
        finding: "수쿰빗·실롬 등 지역별 BTS 접근성 차이가 후기와 안내에서 반복 관측된다",
        evidenceRefs: ["ev1"],
        sourceClasses: ["review"],
        confidence: 0.8,
        limitations: [],
      },
    ],
    evidenceAssessment: [],
    contradictedClaims: ["방콕 전 지역 호텔은 이동이 동일하다"],
    unresolvedQuestions: ["특정 호텔의 확정 조식 가격은?"],
    usableFactIds: ["ev1"],
    refutationNotes: null,
    limitations: ["개별 호텔 가격·운항 빈도는 확인하지 않음"],
    alternateFallbackUsed: false,
    researchSupportedFraming: ["위치/접근성을 등급과 함께 비교할 근거가 있다"],
    observability: {
      plannedQuestionCount: 1,
      answeredQuestionCount: 1,
      unresolvedQuestionCount: 1,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 0,
      externalQueriesSuccessful: 0,
      sourceClasses: ["review"],
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

function baseAsset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  const brief = evidenceBrief();
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
  });
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
    titleKo: "방콕 가족여행, 호텔 등급보다 위치를 먼저 봐야 할까",
    dekKo: "부모님 동반 숙소 선택의 핵심 기준",
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

function exportInputFromAsset(asset: CanonicalMarketingAsset = baseAsset()) {
  const prop = proposition();
  const brief = evidenceBrief();
  return {
    candidateId: "cmc_test_asset",
    assetId: asset.assetId,
    version: asset.version,
    sourceRevision: asset.sourceRevision,
    editable: {
      titleKo: asset.titleKo,
      openingHookKo: asset.openingHookKo,
      bodyKo: asset.bodyKo,
      keyTakeawaysKo: [...asset.keyTakeawaysKo],
      decisionGuidanceKo: asset.decisionGuidanceKo,
    },
    contextReadOnly: {
      storyTitleKo: BANGKOK.storyQuestion,
      storyQuestionKo: BANGKOK.storyQuestion,
      audienceProblemKo: prop.audienceProblem,
      decisionAtStakeKo: prop.audienceTension,
      readerPayoffKo: BANGKOK.readerPayoff,
      storySupportVerdict: asset.storySupportVerdict,
      supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
      keyEvidenceKo: buildKeyEvidenceKo({ asset, evidenceBrief: brief }),
      limitationsKo: [...asset.limitationsKo],
      forbiddenClaimsKo: [...asset.forbiddenClaimsKo],
      contentPromiseKo: prop.contentPromise,
      ctaIntentKo: asset.optionalCtaIntentKo,
    },
  };
}

describe("CANONICAL_ASSET_CHATGPT_TRANSFER export", () => {
  it("exports contract, sourceRevision, editable, story/evidence context, notesKo; JSON only", () => {
    const input = exportInputFromAsset();
    const payload = buildCanonicalAssetChatGptExportPayload(input);
    expect(payload.contract).toBe(CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT);
    expect(payload.sourceRevision).toBe(input.sourceRevision);
    expect(payload.editable.titleKo).toContain("방콕");
    expect(payload.contextReadOnly.storyQuestionKo).toContain("부모님");
    expect(payload.contextReadOnly.decisionAtStakeKo).toBe("등급 vs 위치");
    expect(payload.contextReadOnly.keyEvidenceKo.length).toBeGreaterThan(0);
    expect(payload.contextReadOnly.limitationsKo.length).toBeGreaterThan(0);
    expect(payload.contextReadOnly.forbiddenClaimsKo).toContain(
      "방콕 전 지역 호텔은 이동이 동일하다",
    );
    expect(payload.notesKo.some((n) => n.includes("keyEvidenceKo"))).toBe(true);
    expect(payload.notesKo.some((n) => n.includes("forbiddenClaimsKo"))).toBe(true);

    const text = buildCanonicalAssetChatGptClipboardText(input);
    expect(text.trim().startsWith("{")).toBe(true);
    expect(text).not.toContain("Senior Marketing");
    expect(text).not.toContain("STEP 1");
  });
});

describe("CANONICAL_ASSET_CHATGPT_TRANSFER import contract", () => {
  const asset = baseAsset();
  const input = exportInputFromAsset(asset);

  it("valid current contract passes; fenced JSON passes", () => {
    const text = buildCanonicalAssetChatGptClipboardText(input);
    const parsed = parseCanonicalAssetChatGptImport({
      raw: text,
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(parsed.ok).toBe(true);

    const fenced = `참고:\n\`\`\`json\n${text}\n\`\`\`\n끝`;
    const fencedParsed = parseCanonicalAssetChatGptImport({
      raw: fenced,
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(fencedParsed.ok).toBe(true);
  });

  it("rejects wrong contract and arbitrary title/body JSON", () => {
    const wrong = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify({
        contract: "other-v1",
        candidateId: input.candidateId,
        assetId: input.assetId,
        version: input.version,
        sourceRevision: input.sourceRevision,
        editable: input.editable,
      }),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.code).toBe("contract_mismatch");

    const loose = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify({ titleKo: "제목", bodyKo: "본문입니다만 계약이 없습니다." }),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(loose.ok).toBe(false);
  });

  it("rejects malformed and ambiguous multi-object JSON", () => {
    const malformed = parseCanonicalAssetChatGptImport({
      raw: "{ not json",
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.code).toBe("invalid_json");

    const ambiguous = parseCanonicalAssetChatGptImport({
      raw: `${JSON.stringify(buildCanonicalAssetChatGptExportPayload(input))}\n${JSON.stringify(buildCanonicalAssetChatGptExportPayload(input))}`,
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) expect(ambiguous.code).toBe("ambiguous_json");
  });
});

describe("CANONICAL_ASSET_CHATGPT_TRANSFER identity / stale", () => {
  const asset = baseAsset();
  const input = exportInputFromAsset(asset);
  const text = buildCanonicalAssetChatGptClipboardText(input);

  it("rejects candidate/asset/version/sourceRevision mismatch and missing sourceRevision", () => {
    expect(
      parseCanonicalAssetChatGptImport({
        raw: text,
        expectedCandidateId: "other",
        expectedAssetId: input.assetId,
        expectedVersion: input.version,
        expectedSourceRevision: input.sourceRevision,
      }).ok,
    ).toBe(false);

    expect(
      parseCanonicalAssetChatGptImport({
        raw: text,
        expectedCandidateId: input.candidateId,
        expectedAssetId: "cma_other",
        expectedVersion: input.version,
        expectedSourceRevision: input.sourceRevision,
      }).ok,
    ).toBe(false);

    const staleVersion = parseCanonicalAssetChatGptImport({
      raw: text,
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: 2,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(staleVersion.ok).toBe(false);
    if (!staleVersion.ok) {
      expect(staleVersion.messageKo).toBe(STALE_ASSET_MESSAGE_KO);
    }

    const staleRev = parseCanonicalAssetChatGptImport({
      raw: text,
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: "rev_other",
    });
    expect(staleRev.ok).toBe(false);

    const payload = buildCanonicalAssetChatGptExportPayload(input) as Record<string, unknown>;
    delete payload.sourceRevision;
    const missingRev = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify(payload),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(missingRev.ok).toBe(false);
    if (!missingRev.ok) expect(missingRev.code).toBe("missing_source_revision");
  });
});

describe("CANONICAL_ASSET_CHATGPT_TRANSFER editable-only + takeaways", () => {
  const asset = baseAsset();
  const input = exportInputFromAsset(asset);

  it("applies only five editable fields; ignores limitations/forbidden/status/provenance", () => {
    const payload = buildCanonicalAssetChatGptExportPayload(input);
    const rogue = {
      ...payload,
      status: "approved",
      approved: true,
      approvedVersion: 99,
      storyPointId: "hijacked",
      generatedBy: "chatgpt",
      editable: {
        ...payload.editable,
        titleKo: "사람 손으로 다듬은 제목",
        limitationsKo: ["새 한계"],
        forbiddenClaimsKo: ["새 금지"],
      },
      contextReadOnly: {
        ...payload.contextReadOnly,
        limitationsKo: ["덮어쓰기 시도"],
      },
    };
    const parsed = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify(rogue),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.edits.titleKo).toBe("사람 손으로 다듬은 제목");
    expect(parsed.edits).not.toHaveProperty("forbiddenClaimsKo");
    expect(parsed.edits.limitationsKo).toBeUndefined();
    expect(Object.keys(parsed.edits).sort()).toEqual(
      [
        "bodyKo",
        "decisionGuidanceKo",
        "keyTakeawaysKo",
        "openingHookKo",
        "titleKo",
      ].sort(),
    );
  });

  it("normalizes newline / bullet / numbered takeaways", () => {
    expect(normalizeKeyTakeawaysKo(["  A  ", "", "B"])).toEqual(["A", "B"]);
    expect(
      normalizeKeyTakeawaysKo("- 첫 요점\n• 둘째\n* 셋째\n1. 넷째\n2) 다섯째\n\n"),
    ).toEqual(["첫 요점", "둘째", "셋째", "넷째", "다섯째"]);

    const payload = buildCanonicalAssetChatGptExportPayload(input);
    payload.editable = {
      ...payload.editable,
      keyTakeawaysKo: "- 접근성부터\n1. 등급 교환 금지" as unknown as string[],
    };
    const parsed = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify(payload),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.edits.keyTakeawaysKo).toEqual(["접근성부터", "등급 교환 금지"]);
  });
});

describe("CANONICAL_ASSET_CHATGPT_TRANSFER validation + workflow", () => {
  it("evidence-aligned edit passes; unsupported numeric / forbidden / story drift rejected", () => {
    const asset = baseAsset();
    const brief = evidenceBrief();
    const prop = proposition();
    const ok = validateCanonicalAssetChatGptEdits({
      currentAsset: asset,
      edits: {
        titleKo: asset.titleKo,
        openingHookKo: asset.openingHookKo,
        bodyKo: `${asset.bodyKo}\n\n접근성 관측을 기준으로 비교 순서를 명확히 했습니다.`,
        keyTakeawaysKo: asset.keyTakeawaysKo,
        decisionGuidanceKo: asset.decisionGuidanceKo,
      },
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
    });
    expect(ok.ok).toBe(true);

    const price = validateCanonicalAssetChatGptEdits({
      currentAsset: asset,
      edits: {
        bodyKo: `${asset.bodyKo}\n\n항공권 899,000원으로 확정 가격이다.`,
      },
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
    });
    expect(price.ok).toBe(false);
    if (!price.ok) {
      expect(price.issues.some((i) => i.code === "unsupported_price_or_route")).toBe(true);
    }

    const forbidden = validateCanonicalAssetChatGptEdits({
      currentAsset: asset,
      edits: {
        bodyKo: `${asset.bodyKo}\n\n방콕 전 지역 호텔은 이동이 동일하다.`,
      },
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.issues.some((i) => i.code === "contradicted_claim_revived")).toBe(true);
    }

    const drifted = validateCanonicalAssetChatGptEdits({
      currentAsset: { ...asset, storyPointId: "other_story" },
      edits: { titleKo: "다른 제목으로 살짝 수정" },
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
    });
    expect(drifted.ok).toBe(false);
    if (!drifted.ok) {
      expect(drifted.issues.some((i) => i.code === "story_id_drift")).toBe(true);
    }
  });

  it("valid import → human_edited, not approved; AI original approval still works", () => {
    const asset = baseAsset();
    const input = exportInputFromAsset(asset);
    const payload = buildCanonicalAssetChatGptExportPayload(input);
    payload.editable.titleKo = "사람이 다듬은 방콕 숙소 위치 기준";
    const parsed = parseCanonicalAssetChatGptImport({
      raw: JSON.stringify(payload),
      expectedCandidateId: input.candidateId,
      expectedAssetId: input.assetId,
      expectedVersion: input.version,
      expectedSourceRevision: input.sourceRevision,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const domain = validateCanonicalAssetChatGptEdits({
      currentAsset: asset,
      edits: parsed.edits,
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: evidenceBrief(),
      proposition: proposition(),
    });
    expect(domain.ok).toBe(true);
    if (!domain.ok) return;

    const edited = applyHumanCanonicalAssetEdit({
      asset,
      edits: parsed.edits,
    });
    expect(edited.status).toBe("human_edited");
    expect(edited.humanEdited).toBe(true);
    expect(edited.approvedVersion).toBeNull();
    expect(edited.approvalSource).toBeNull();
    expect(edited.version).toBe(asset.version + 1);

    const approvedOriginal = approveCanonicalMarketingAsset({
      asset: baseAsset(),
      mode: "ai_original",
      approvedBy: "tester",
    });
    expect(approvedOriginal.status).toBe("approved");
    expect(approvedOriginal.approvalSource).toBe("ai_original");

    const approvedEdited = approveCanonicalMarketingAsset({
      asset: edited,
      mode: "human_edited",
      approvedBy: "tester",
    });
    expect(approvedEdited.status).toBe("approved");
    expect(approvedEdited.approvalSource).toBe("human_edited");
  });

  it("PARTIALLY_SUPPORTED boundary violation rejected", () => {
    const boundary = "숙소 위치를 등급과 함께 비교할 근거가 있다";
    const brief = evidenceBrief("PARTIALLY_SUPPORTED", boundary);
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
    });
    const asset = baseAsset({
      sourceRevision,
      evidenceRevision: writer.evidenceRevision,
      propositionRevision: writer.proposition.propositionRevision,
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundaryKo: boundary,
    });
    const check = validateCanonicalAssetChatGptEdits({
      currentAsset: asset,
      edits: {
        bodyKo: `${BANGKOK.storyClaim}\n\n하지만 경계 밖의 넓은 주장만 반복한다.`,
      },
      storyPoint: BANGKOK,
      storyPointHash: createStoryPointHash(BANGKOK),
      evidenceBrief: brief,
      proposition: prop,
    });
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.issues.some((i) => i.code === "boundary_violation")).toBe(true);
    }
  });
});
