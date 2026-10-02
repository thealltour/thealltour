import { describe, expect, it } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  CONTENT_PROPOSITION_CONTRACT,
  type ContentProposition,
} from "@/lib/marketing/content/proposition/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT,
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION,
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
  EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS,
  RESEARCH_FINDING_SUPPORT_LEVELS,
  RESEARCH_HANDOFF_CANONICAL_NOT_APPROVED_MESSAGE_KO,
  RESEARCH_OUTPUT_STATUSES,
  buildEditorialResearchHandoff,
  serializeEditorialResearchHandoff,
  type BuildEditorialResearchHandoffInput,
  type EditorialResearchBundleChatGptHandoff,
} from "@/lib/marketing/editorialDirector/researchHandoff";
import { buildEditorialResearchHandoffForCandidate } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";

const NOW = new Date("2026-09-27T01:02:03.000Z");

const STORY: StoryContentPoint = {
  contract: STORY_CONTENT_POINT_CONTRACT,
  pointId: "sp_bangkok_hotel",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
  storyClaim: "방콕 가족여행에서 숙소 위치가 호텔 등급만큼 중요할 수 있다",
  whyInteresting: "좋은 호텔 직관이 이동 불편으로 자주 깨진다",
  audienceTension: "등급 vs 이동",
  curiosityGap: "높은 등급이 항상 낫다는 직관과 이동 편의가 충돌한다",
  readerPayoff: "부모님 동반 숙소 비교 기준",
  mechanisms: ["counter_intuition"],
  researchNeeded: ["숙박 지역별 BTS 접근성"],
  researchQuestions: ["방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?"],
  genericRisk: "체크리스트 붕괴",
  genericRiskMitigation: null,
  channelPotential: {
    conversation: "high",
    visualExplainability: "medium",
    searchDepth: "high",
    shortformHookability: "medium",
  },
  nonGoals: ["방콕 호텔 종합 가이드"],
  agendaFitNotes: null,
};

function brief(overrides: Partial<EvidenceBackedStoryBrief> = {}): EvidenceBackedStoryBrief {
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: STORY.pointId,
    storyPointHash: "sph_1",
    agendaLogicalIdentity: "bangkok_hotel",
    researchExecutionStatus: "partial",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary: "지역별 접근성 차이까지만 주장",
    researchQuestionFindings: [
      {
        question: "방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?",
        status: "answered",
        finding: "수쿰빗·실롬 등 지역별 BTS 접근성 차이가 반복 관측된다",
        evidenceRefs: ["ev1"],
        sourceClasses: ["review"],
        confidence: 0.8,
        limitations: ["표본이 후기 중심"],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ev1",
        relationship: "supports",
        relevanceToStoryPoint: 0.9,
        epistemicType: "observed_signal",
        sourceClass: "review",
        note: "지역 후기",
      },
    ] as EvidenceBackedStoryBrief["evidenceAssessment"],
    contradictedClaims: ["방콕 전 지역 호텔은 이동이 동일하다"],
    unresolvedQuestions: ["특정 호텔의 확정 조식 가격은?"],
    usableFactIds: ["ev1"],
    refutationNotes: null,
    limitations: ["개별 호텔 가격은 확인하지 않음"],
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
    ...overrides,
  };
}

const PROPOSITION = {
  contract: CONTENT_PROPOSITION_CONTRACT,
  primaryAudience: "부모님 동반 방콕 가족여행 준비자",
  audienceProblem: "등급만 보고 고르면 이동 피로가 커진다",
  audienceTension: "등급 vs 위치",
  whyNow: null,
  contentPromise: "숙소 위치를 등급과 함께 비교하는 기준",
  readerGain: "무엇을 먼저 볼지 판단 기준",
  specificTakeaways: ["BTS 접근성을 먼저 본다"],
  proofRequirements: [],
  contentGapUsed: "위치 우선 기준 부족",
  engagementMechanism: "save_worthy_checklist",
  desiredAudienceAction: "save",
  angle: "방콕 가족 호텔은 위치가 등급만큼 중요하다",
  keyMessage: "위치부터 비교하라",
  commercialIntent: "informational",
  propositionStrength: "usable",
  limitations: ["개별 요금은 단정하지 않음"],
} as unknown as ContentProposition;

function asset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_rev123",
    version: 3,
    status: "approved",
    agendaId: "ag_bangkok",
    storyPointId: STORY.pointId,
    storyPointHash: "sph_1",
    evidenceBriefRef: null,
    evidenceRevision: "evr_1",
    contentPropositionRef: null,
    propositionRevision: "prr_1",
    sourceRevision: "rev123",
    titleKo: "방콕 가족여행, 호텔 등급보다 위치를 먼저",
    dekKo: "부모님 동반 숙소 선택 기준",
    openingHookKo: "등급만 올리면 편해질 것 같다는 직관이 틀릴 때가 있습니다.",
    bodyKo: "수쿰빗·실롬처럼 지역에 따라 BTS 접근성 차이가 뚜렷합니다.",
    keyTakeawaysKo: ["지역별 BTS 접근성부터 비교한다"],
    decisionGuidanceKo: "이동 동선을 먼저 적고 등급을 비교하세요.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    limitationsKo: ["개별 호텔 요금은 단정하지 않음"],
    forbiddenClaimsKo: ["모든 호텔이 역세권이다"],
    supportedClaimBoundaryKo: "지역별 접근성 차이까지만 주장",
    unresolvedQuestionsKo: ["조식 가격"],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    generatedAt: "2026-09-26T00:00:00.000Z",
    editedAt: null,
    approvedAt: "2026-09-26T10:00:00.000Z",
    approvedVersion: 3,
    humanEdited: false,
    approvalSource: "ai_original",
    approvedBy: "ysh",
    generatedBy: "asset-source-writer",
    repairCount: 0,
    validationIssues: [],
    editorialArchetype: "counter_intuition",
    ...overrides,
  };
}

function input(overrides: Partial<BuildEditorialResearchHandoffInput> = {}): BuildEditorialResearchHandoffInput {
  return {
    candidateId: "cand_bkk_1",
    asset: asset(),
    storyPoint: STORY,
    proposition: PROPOSITION,
    evidenceBrief: brief(),
    now: NOW,
    ...overrides,
  };
}

function buildOk(overrides: Partial<BuildEditorialResearchHandoffInput> = {}): EditorialResearchBundleChatGptHandoff {
  const result = buildEditorialResearchHandoff(input(overrides));
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`);
  return result.payload;
}

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

describe("editorial research handoff — approved gate", () => {
  it.each([
    ["draft", { status: "draft", approvedVersion: null }],
    ["human_edited", { status: "human_edited", approvedVersion: 2 }],
    ["stale", { status: "stale" }],
    ["validation_failed", { status: "validation_failed" }],
    ["approved but version drifted", { status: "approved", approvedVersion: 2 }],
    ["approved without approvedVersion", { status: "approved", approvedVersion: null }],
  ] as const)("fails closed for %s", (_label, overrides) => {
    const result = buildEditorialResearchHandoff(
      input({ asset: asset(overrides as Partial<CanonicalMarketingAsset>) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("canonical_not_approved");
    expect(result.messageKo).toBe(RESEARCH_HANDOFF_CANONICAL_NOT_APPROVED_MESSAGE_KO);
    expect(result.messageKo).toMatch(/승인/);
  });

  it("fails closed when the asset is missing", () => {
    const result = buildEditorialResearchHandoff(input({ asset: null }));
    expect(result).toMatchObject({ ok: false, code: "canonical_asset_missing" });
  });
});

describe("editorial research handoff — identity", () => {
  it("emits contract identity and stable ids from the approved Canonical", () => {
    const payload = buildOk();
    expect(payload.contract).toBe(EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT);
    expect(payload.contract).toBe("editorial-research-bundle-chatgpt-handoff-v1");
    expect(payload.contractVersion).toBe(EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION);
    expect(payload.candidateId).toBe("cand_bkk_1");
    expect(payload.assetId).toBe("cma_rev123");
    expect(payload.canonicalVersion).toBe(3);
    expect(payload.sourceRevision).toBe("rev123");
    expect(payload.exportedAt).toBe(NOW.toISOString());
    expect(payload.canonicalStatus).toBe("approved");
    expect(payload.researchPolicy).toBe("verify_and_expand");
  });

  it("is deterministic apart from exportedAt and echoes identity in outputContract", () => {
    const a = buildOk();
    const b = buildOk({ now: new Date("2026-09-28T00:00:00.000Z") });
    expect({ ...a, exportedAt: "" }).toEqual({ ...b, exportedAt: "" });
    expect(a.outputContract.requiredEcho).toEqual({
      contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
      candidateId: "cand_bkk_1",
      assetId: "cma_rev123",
      canonicalVersion: 3,
      sourceRevision: "rev123",
    });
  });

  it("serializes to parseable 2-space JSON", () => {
    const payload = buildOk();
    const text = serializeEditorialResearchHandoff(payload);
    expect(text).toContain('\n  "contract": "editorial-research-bundle-chatgpt-handoff-v1"');
    expect(JSON.parse(text)).toEqual(payload);
  });
});

describe("editorial research handoff — sections", () => {
  it("uses approvedCanonical as the factual baseline including evidence/safety fields", () => {
    const { approvedCanonical } = buildOk();
    expect(approvedCanonical.authority).toBe("factual_baseline");
    expect(approvedCanonical.titleKo).toBe("방콕 가족여행, 호텔 등급보다 위치를 먼저");
    expect(approvedCanonical.bodyKo).toContain("BTS");
    expect(approvedCanonical.forbiddenClaimsKo).toEqual(["모든 호텔이 역세권이다"]);
    expect(approvedCanonical.limitationsKo).toEqual(["개별 호텔 요금은 단정하지 않음"]);
    expect(approvedCanonical.supportedClaimBoundaryKo).toBe("지역별 접근성 차이까지만 주장");
    expect(approvedCanonical.evidenceRefs).toEqual([{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }]);
    expect(approvedCanonical.approvedVersion).toBe(3);
  });

  it("marks editorialContext as background, not factual authority", () => {
    const { editorialContext } = buildOk();
    expect(editorialContext.authority).toBe("background_only_not_factual");
    expect(editorialContext.noteKo).toMatch(/사실 근거가 아니/);
    expect(editorialContext.story?.storyQuestion).toBe(STORY.storyQuestion);
    expect(editorialContext.proposition?.angle).toBe("방콕 가족 호텔은 위치가 등급만큼 중요하다");
  });

  it("drops lock-only Story stubs and Story for a different storyPointId", () => {
    const stub: StoryContentPoint = {
      ...STORY,
      storyQuestion: null,
      storyClaim: null,
      whyInteresting: "",
      audienceTension: "",
      curiosityGap: "",
      readerPayoff: "",
      researchQuestions: [],
    };
    expect(buildOk({ storyPoint: stub }).editorialContext.story).toBeNull();
    expect(
      buildOk({ storyPoint: { ...STORY, pointId: "sp_other" } }).editorialContext.story,
    ).toBeNull();
  });

  it("sets citationPolicy exactly", () => {
    const { citationPolicy } = buildOk();
    expect(citationPolicy.researchProvenanceRequired).toBe(true);
    expect(citationPolicy.surfaceCitations).toBe("none");
    expect(citationPolicy.surfaceSourceUrls).toBe(false);
  });

  it("sets terminology policy with locked terms and no transliteration", () => {
    const { terminology } = buildOk({ canonicalLockedTerms: [" BTS ", "Sukhumvit", "BTS", ""] });
    expect(terminology.preserveCanonicalSpelling).toBe(true);
    expect(terminology.allowUnverifiedKoreanTransliteration).toBe(false);
    expect(terminology.canonicalLockedTerms).toEqual(["BTS", "Sukhumvit"]);
    expect(buildOk().terminology.canonicalLockedTerms).toEqual([]);
  });

  it("requests research only", () => {
    const payload = buildOk();
    expect([...payload.requestedArtifacts]).toEqual(["research"]);
    expect([...payload.requestedArtifacts]).toEqual([...EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS]);
  });
});

describe("editorial research handoff — researchContext projection", () => {
  it("projects EvidenceBrief boundary, findings, contradictions, unresolved, limitations", () => {
    const { researchContext } = buildOk();
    expect(researchContext.available).toBe(true);
    expect(researchContext.authority).toBe("prior_research_state_to_verify");
    expect(researchContext.researchExecutionStatus).toBe("partial");
    expect(researchContext.storySupportVerdict).toBe("PARTIALLY_SUPPORTED");
    expect(researchContext.supportedClaimBoundary).toBe("지역별 접근성 차이까지만 주장");
    expect(researchContext.findings).toEqual([
      {
        question: "방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?",
        status: "answered",
        finding: "수쿰빗·실롬 등 지역별 BTS 접근성 차이가 반복 관측된다",
        confidence: 0.8,
        sourceClasses: ["review"],
        evidenceRefs: ["ev1"],
        limitations: ["표본이 후기 중심"],
      },
    ]);
    expect(researchContext.contradictedClaims).toEqual(["방콕 전 지역 호텔은 이동이 동일하다"]);
    expect(researchContext.unresolvedQuestions).toEqual(["특정 호텔의 확정 조식 가격은?"]);
    expect(researchContext.limitations).toEqual(["개별 호텔 가격은 확인하지 않음"]);
    expect(researchContext.evidenceAssessment[0]).toEqual({
      evidenceId: "ev1",
      relationship: "supports",
      epistemicType: "observed_signal",
      sourceClass: "review",
      note: "지역 후기",
    });
  });

  it("does not fabricate source metadata", () => {
    const { researchContext, approvedCanonical } = buildOk();
    expect(researchContext.sourceMetadataAvailable).toBe(false);
    const keys = collectKeys({ researchContext, approvedCanonical });
    for (const forbidden of ["url", "title", "publisher", "date", "sources", "sourceTier"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(JSON.stringify(researchContext)).not.toMatch(/https?:\/\//);
  });

  it("marks research unavailable when no brief or brief belongs to another Story", () => {
    for (const evidenceBrief of [null, brief({ storyPointId: "sp_other" })]) {
      const { researchContext } = buildOk({ evidenceBrief });
      expect(researchContext.available).toBe(false);
      expect(researchContext.findings).toEqual([]);
      expect(researchContext.contradictedClaims).toEqual([]);
      expect(researchContext.sourceMetadataAvailable).toBe(false);
    }
  });
});

describe("editorial research handoff — outputContract", () => {
  it("asks for the identity echo and a research object only", () => {
    const { outputContract } = buildOk();
    expect(outputContract.researchRequired).toBe(true);
    expect([...outputContract.topLevelKeyOrder]).toEqual([
      "contract",
      "candidateId",
      "assetId",
      "canonicalVersion",
      "sourceRevision",
      "research",
    ]);
    const rules = outputContract.rulesKo.join("\n");
    expect(rules).toMatch(/research 객체만 작성/);
    expect(rules).toMatch(/이 단계에서 작성하지 않습니다/);
  });

  it("defines research schema with status, questions, findings, sources, unresolved, conflicts", () => {
    const research = buildOk().outputContract.schema.research as Record<string, unknown>;
    expect(research.status).toBe(RESEARCH_OUTPUT_STATUSES.join(" | "));
    expect(research.questions).toEqual(["string"]);
    expect(research.unresolved).toEqual(["string"]);
    expect(Array.isArray(research.canonicalConflicts)).toBe(true);
    const finding = (research.findings as Array<Record<string, unknown>>)[0];
    expect(Object.keys(finding)).toEqual([
      "findingId",
      "claim",
      "supportLevel",
      "usableForEditorial",
      "freshness",
      "sources",
    ]);
    expect(finding.supportLevel).toBe(RESEARCH_FINDING_SUPPORT_LEVELS.join(" | "));
    expect(finding.freshness).toMatch(/null/);
    const source = (finding.sources as Array<Record<string, unknown>>)[0];
    expect(Object.keys(source)).toEqual(["title", "publisher", "date", "url", "sourceTier"]);
    expect(source.date).toMatch(/null/);
  });

  it("carries no narrative or channel schema", () => {
    const { schema } = buildOk().outputContract;
    expect(Object.keys(schema)).toEqual(["research"]);
  });
});

describe("editorial research handoff — server loader", () => {
  it("builds from the candidate-embedded Canonical and fails closed for drafts", () => {
    const candidate = {
      candidateId: "cand_bkk_1",
      businessDateKst: "2026-09-26",
      canonicalMarketingAsset: asset(),
      contentPlan: { proposition: PROPOSITION },
    } as unknown as CompletedMarketingCandidate;

    const ok = buildEditorialResearchHandoffForCandidate({ candidate, packageRoot: null, now: NOW });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.payload.assetId).toBe("cma_rev123");
      expect(ok.payload.editorialContext.proposition?.keyMessage).toBe("위치부터 비교하라");
      expect(ok.payload.researchContext.available).toBe(false);
    }

    const draft = buildEditorialResearchHandoffForCandidate({
      candidate: {
        ...candidate,
        canonicalMarketingAsset: asset({ status: "draft", approvedVersion: null }),
      } as CompletedMarketingCandidate,
      packageRoot: null,
    });
    expect(draft).toMatchObject({ ok: false, code: "canonical_not_approved" });

    const missing = buildEditorialResearchHandoffForCandidate({
      candidate: { ...candidate, canonicalMarketingAsset: undefined } as unknown as CompletedMarketingCandidate,
      packageRoot: null,
    });
    expect(missing).toMatchObject({ ok: false, code: "canonical_asset_missing" });
  });
});
