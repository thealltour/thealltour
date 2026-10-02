import { describe, expect, it } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT,
  INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
  INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO,
  INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS,
  buildInstagramCardnewsHandoff,
  serializeInstagramCardnewsHandoff,
} from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff";

const NOW = new Date("2026-09-29T01:02:03.000Z");

function asset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_rev123",
    version: 4,
    status: "approved",
    agendaId: "ag_bangkok",
    storyPointId: "sp_bangkok_hotel",
    storyPointHash: "sph_1",
    evidenceBriefRef: null,
    evidenceRevision: "evr_1",
    contentPropositionRef: null,
    propositionRevision: "prr_1",
    sourceRevision: "rev123",
    titleKo: "방콕 가족여행, 호텔 등급보다 위치를 먼저",
    dekKo: null,
    openingHookKo: "등급만 올리면 편해질 것 같다는 직관이 틀릴 때가 있습니다.",
    bodyKo: "수쿰빗·실롬처럼 지역에 따라 BTS 접근성 차이가 뚜렷합니다.",
    keyTakeawaysKo: ["지역별 BTS 접근성부터 비교한다"],
    decisionGuidanceKo: "이동 동선을 먼저 적고 등급을 비교합니다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    limitationsKo: [],
    forbiddenClaimsKo: ["모든 5성급 호텔이 역과 멀다"],
    supportedClaimBoundaryKo: "지역별 접근성 차이까지만 주장",
    unresolvedQuestionsKo: [],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    generatedAt: "2026-09-26T00:00:00.000Z",
    editedAt: "2026-09-28T00:00:00.000Z",
    approvedAt: "2026-09-28T10:00:00.000Z",
    approvedVersion: 4,
    humanEdited: true,
    approvalSource: "human_edited",
    approvedBy: "ysh",
    generatedBy: "asset-source-writer",
    repairCount: 0,
    validationIssues: [],
    researchRevision: {
      importId: "xe_research_1",
      fromVersion: 3,
      appliedConflictIndexes: [0],
      removedForbiddenClaims: ["미쉐린 선정 단정"],
      removedItems: [],
      addedEvidenceIds: [],
      appliedAt: "2026-09-28T00:00:00.000Z",
      appliedBy: "ysh",
    },
    ...overrides,
  };
}

describe("buildInstagramCardnewsHandoff", () => {
  it("builds an Instagram-only handoff for the approved Canonical with identity echo", () => {
    const out = buildInstagramCardnewsHandoff({ candidateId: "cand_bkk_1", asset: asset(), now: NOW });
    if (!out.ok) throw new Error(out.code);
    const { payload, warnings } = out;

    expect(warnings).toEqual([]);
    expect(payload).toMatchObject({
      contract: INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT,
      contractVersion: 1,
      candidateId: "cand_bkk_1",
      assetId: "cma_rev123",
      canonicalVersion: 4,
      sourceRevision: "rev123",
      exportedAt: NOW.toISOString(),
      canonicalStatus: "approved",
      researchApplied: true,
    });
    expect(payload.approvedCanonical.authority).toBe("factual_baseline");
    expect(payload.approvedCanonical.forbiddenClaimsKo).toEqual(["모든 5성급 호텔이 역과 멀다"]);
    expect(payload.editorialContext.authority).toBe("background_only_not_factual");
    expect(payload.citationPolicy.surfaceCitations).toBe("none");

    expect(payload.constraints).toEqual({
      cardCount: { min: 4, max: 10, preferredMin: 4, preferredMax: 6 },
      fieldMaxLength: { kicker: 40, headline: 80, body: 400, microcopy: 120, coverTitleKo: 80 },
      hashtagMax: 12,
      aspectRatio: "4:5",
    });

    const output = payload.outputContract;
    expect(output.requiredEcho).toEqual({
      contract: INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
      candidateId: "cand_bkk_1",
      assetId: "cma_rev123",
      canonicalVersion: 4,
      sourceRevision: "rev123",
    });
    expect(output.topLevelKeyOrder).toEqual(INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS);
    expect(Object.keys(output.schema)).toEqual(["narrative", "instagram"]);
    expect(Object.keys(output.schema.instagram)).toEqual(["carouselPlan", "cardCopy", "caption", "coverTitleKo"]);
    expect(JSON.stringify(output.schema)).not.toMatch(/"research"|"threads"|"naverBlog"/);
  });

  it("warns when the approved Canonical carries no applied research", () => {
    const out = buildInstagramCardnewsHandoff({
      candidateId: "cand_bkk_1",
      asset: asset({ researchRevision: null }),
      now: NOW,
    });
    if (!out.ok) throw new Error(out.code);
    expect(out.payload.researchApplied).toBe(false);
    expect(out.warnings).toEqual([INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO.researchNotApplied]);
  });

  it("refuses a missing or unapproved Canonical", () => {
    expect(buildInstagramCardnewsHandoff({ candidateId: "c", asset: null })).toMatchObject({
      ok: false,
      code: "canonical_asset_missing",
    });
    expect(
      buildInstagramCardnewsHandoff({
        candidateId: "c",
        asset: asset({ status: "human_edited", version: 5, approvedVersion: 4 }),
      }),
    ).toMatchObject({ ok: false, code: "canonical_not_approved" });
  });

  it("serializes to pretty JSON that round-trips", () => {
    const out = buildInstagramCardnewsHandoff({ candidateId: "cand_bkk_1", asset: asset(), now: NOW });
    if (!out.ok) throw new Error(out.code);
    const text = serializeInstagramCardnewsHandoff(out.payload);
    expect(text.startsWith("{\n  ")).toBe(true);
    expect(JSON.parse(text)).toEqual(out.payload);
  });
});
