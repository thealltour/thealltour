import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ExternalResearchDraftError,
  buildCanonicalDraftFromResearch,
  candidateMatchesCanonical,
  readExternalResearchSummary,
  researchEvidenceId,
} from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";
import {
  CANONICAL_HISTORY_DIRECTORY,
  applyExternalResearchToCanonicalAsset,
  approveCanonicalAsset,
} from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { parseDurableCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import {
  persistCanonicalAssetToPackage,
  readCanonicalAssetFromPackage,
} from "@/lib/marketing/canonicalAsset/persistence";
import { validateCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT } from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import {
  EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
  EXTERNAL_EDITORIAL_PROVIDER,
  type ExternalEditorialCandidate,
} from "@/lib/marketing/publishable/channelSources/contracts";
import { persistExternalEditorialCandidate } from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

const CANDIDATE_ID = "cmc_daily_marketing_production_2026_09_19_13";
const IMPORT_ID = "xe_1790664679428_09c87ca6b0";
const NOW = new Date("2026-09-29T03:00:00.000Z");

const FORBIDDEN_BIB = "2023 미쉐린 빕 구르망에 선정된 집";
const FORBIDDEN_STOOL = "작은 플라스틱 의자에 앉아 먹는 가게";
const FORBIDDEN_BROTH = "10시간 끓인 육수";
const FORBIDDEN_KEEP = "하노이 최고의 쌀국수";
const TAKEAWAY_STALE = "미쉐린 선정 여부는 확인되지 않았다";
const TAKEAWAY_KEEP = "아침 일찍 가야 줄이 짧다";

function approvedAsset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_pho_hanoi",
    version: 2,
    status: "approved",
    agendaId: "ag_hanoi",
    storyPointId: "sp_pho",
    storyPointHash: "sph_pho",
    evidenceBriefRef: null,
    evidenceRevision: "evr_pho",
    contentPropositionRef: null,
    propositionRevision: "prr_pho",
    sourceRevision: "src_pho_1",
    titleKo: "하노이 쌀국수 한 그릇",
    dekKo: null,
    openingHookKo: "하노이의 아침은 쌀국수 냄새로 시작됩니다.",
    bodyKo: "구시가지 골목의 쌀국수집은 이른 아침부터 붐빕니다.",
    keyTakeawaysKo: [TAKEAWAY_STALE, TAKEAWAY_KEEP],
    decisionGuidanceKo: "아침 7시 전후 방문을 권합니다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "현지 관측" }],
    limitationsKo: ["영업시간은 바뀔 수 있음"],
    forbiddenClaimsKo: [FORBIDDEN_BIB, FORBIDDEN_STOOL, FORBIDDEN_BROTH, FORBIDDEN_KEEP],
    supportedClaimBoundaryKo: null,
    unresolvedQuestionsKo: [],
    storySupportVerdict: "INSUFFICIENT_EVIDENCE",
    generatedAt: "2026-09-19T04:00:00.000Z",
    editedAt: "2026-09-19T05:00:00.000Z",
    approvedAt: "2026-09-19T06:00:00.000Z",
    approvedVersion: 2,
    humanEdited: true,
    approvalSource: "human_edited",
    approvedBy: "ysh",
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
    ...overrides,
  };
}

const MICHELIN = {
  title: "Phở Bò Ấu Triệu",
  publisher: "MICHELIN Guide",
  date: "2023-06-06",
  url: "https://guide.michelin.com/vn/en/ha-noi/restaurant/pho-bo-au-trieu",
  sourceTier: "official",
};

function finding(findingId: string, claim: string, supportLevel = "verified") {
  return {
    findingId,
    claim,
    supportLevel,
    usableForEditorial: supportLevel === "verified",
    freshness: "2023",
    sources: [MICHELIN],
  };
}

function blockedResult(conflicts?: unknown[]): Record<string, unknown> {
  return {
    contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
    candidateId: CANDIDATE_ID,
    assetId: "cma_pho_hanoi",
    canonicalVersion: 2,
    sourceRevision: "src_pho_1",
    research: {
      status: "blocked",
      questions: ["미쉐린 선정이 사실인가?"],
      findings: [
        finding("F1", "Phở Bò Ấu Triệu는 2023 미쉐린 가이드 빕 구르망에 선정됐다"),
        finding("F2", "가게에는 낮은 플라스틱 의자가 놓여 있다"),
        finding("F3", "육수는 10시간 이상 끓인다고 소개됐다"),
        finding("F4", "주소는 하노이 호안끼엠 Ấu Triệu 거리 34번지다"),
        finding("F5", "현지인 방문 비중이 높다는 언급이 있다", "qualified"),
      ],
      unresolved: ["2026년 현재 영업시간"],
      canonicalConflicts: conflicts ?? [
        {
          canonicalField: "forbiddenClaimsKo",
          canonicalText: FORBIDDEN_BIB,
          findingIds: ["F1"],
          explanation: "미쉐린 공식 페이지에서 2023 빕 구르망 선정을 확인했다.",
        },
        {
          canonicalField: "forbiddenClaimsKo",
          canonicalText: FORBIDDEN_STOOL,
          findingIds: ["F2", "F5"],
          explanation: "공식 소개에 낮은 의자 좌석이 언급된다.",
        },
        {
          canonicalField: "forbiddenClaimsKo",
          canonicalText: FORBIDDEN_BROTH,
          findingIds: ["F3"],
          explanation: "공식 소개에 장시간 끓인 육수가 언급된다.",
        },
        {
          canonicalField: "keyTakeawaysKo",
          canonicalText: TAKEAWAY_STALE,
          findingIds: ["F1", "F4"],
          explanation: "선정 여부가 확인되어 이 요점은 더 이상 맞지 않는다.",
        },
      ],
    },
    narrative: null,
    threads: null,
    instagram: null,
    shortform: null,
    naver_blog: null,
    naver_band: null,
    kakao_channel: null,
  };
}

const CHANNELS: PublishableChannel[] = [
  "threads",
  "shortform",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "instagram",
];

function externalCandidate(
  overrides: Partial<ExternalEditorialCandidate> = {},
  result: Record<string, unknown> = blockedResult(),
): ExternalEditorialCandidate {
  return {
    contract: EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
    importId: IMPORT_ID,
    provider: EXTERNAL_EDITORIAL_PROVIDER,
    importedAt: "2026-09-29T02:00:00.000Z",
    importedBy: "ysh",
    resultContract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
    candidateId: CANDIDATE_ID,
    assetId: "cma_pho_hanoi",
    canonicalVersion: 2,
    sourceRevision: "src_pho_1",
    externalNarrativeFingerprint: "enf_none",
    warnings: [],
    channelReadiness: Object.fromEntries(
      CHANNELS.map((c) => [c, { present: false, materializable: false, issues: ["channel_missing"] }]),
    ) as unknown as ExternalEditorialCandidate["channelReadiness"],
    result,
    ...overrides,
  };
}

function build(conflictIndexes: number[], asset = approvedAsset(), candidate = externalCandidate()) {
  return buildCanonicalDraftFromResearch({
    asset,
    candidate,
    candidateId: CANDIDATE_ID,
    conflictIndexes,
    now: NOW,
    appliedBy: "ysh",
  });
}

function draftError(fn: () => unknown): ExternalResearchDraftError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ExternalResearchDraftError) return error;
    throw error;
  }
  throw new Error("expected ExternalResearchDraftError");
}

describe("readExternalResearchSummary", () => {
  it("classifies each conflict against the current canonical", () => {
    const result = blockedResult([
      ...((blockedResult().research as { canonicalConflicts: unknown[] }).canonicalConflicts),
      { canonicalField: "bodyKo", canonicalText: "구시가지 골목", findingIds: ["F4"], explanation: "본문 보강" },
      { canonicalField: "forbiddenClaimsKo", canonicalText: "없는 문구", findingIds: ["F1"], explanation: "" },
    ]);
    const summary = readExternalResearchSummary(result, approvedAsset());
    expect(summary?.status).toBe("blocked");
    expect(summary?.findings.map((f) => f.findingId)).toEqual(["F1", "F2", "F3", "F4", "F5"]);
    expect(summary?.unresolved).toEqual(["2026년 현재 영업시간"]);
    expect(summary?.conflicts.map((c) => [c.index, c.action])).toEqual([
      [0, "remove_forbidden"],
      [1, "remove_forbidden"],
      [2, "remove_forbidden"],
      [3, "remove_item"],
      [4, "manual"],
      [5, "not_found"],
    ]);
  });

  it("returns null when the result has no research block", () => {
    expect(readExternalResearchSummary({ contract: "x" }, approvedAsset())).toBeNull();
  });
});

describe("buildCanonicalDraftFromResearch", () => {
  it("lifts forbidden claims, drops the stale takeaway, cites verified findings, and bumps to v3 draft", () => {
    const original = approvedAsset();
    const draft = build([0, 1, 2, 3], original);

    expect(draft.version).toBe(3);
    expect(draft.status).toBe("human_edited");
    expect(draft.humanEdited).toBe(true);
    expect(draft.approvedVersion).toBeNull();
    expect(draft.approvedAt).toBeNull();
    expect(draft.approvalSource).toBeNull();
    expect(draft.approvedBy).toBeNull();
    expect(draft.editedAt).toBe(NOW.toISOString());

    expect(draft.forbiddenClaimsKo).toEqual([FORBIDDEN_KEEP]);
    expect(draft.keyTakeawaysKo).toEqual([TAKEAWAY_KEEP]);
    expect(draft.limitationsKo).toEqual(original.limitationsKo);

    expect(draft.bodyKo).toBe(original.bodyKo);
    expect(draft.titleKo).toBe(original.titleKo);
    expect(draft.openingHookKo).toBe(original.openingHookKo);
    expect(draft.storySupportVerdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(draft.sourceRevision).toBe(original.sourceRevision);

    const added = draft.evidenceRefs.slice(original.evidenceRefs.length);
    expect(added.map((e) => e.evidenceId)).toEqual(
      ["F1", "F2", "F3", "F4"].map((f) => researchEvidenceId(IMPORT_ID, f)),
    );
    expect(added.every((e) => e.noteKo?.includes("MICHELIN Guide"))).toBe(true);
    expect(draft.evidenceRefs[0]).toEqual(original.evidenceRefs[0]);

    expect(draft.researchRevision).toEqual({
      importId: IMPORT_ID,
      fromVersion: 2,
      appliedConflictIndexes: [0, 1, 2, 3],
      removedForbiddenClaims: [FORBIDDEN_BIB, FORBIDDEN_STOOL, FORBIDDEN_BROTH],
      removedItems: [{ field: "keyTakeawaysKo", text: TAKEAWAY_STALE }],
      addedEvidenceIds: added.map((e) => e.evidenceId),
      appliedAt: NOW.toISOString(),
      appliedBy: "ysh",
    });
    expect(original.version).toBe(2);
    expect(original.forbiddenClaimsKo).toHaveLength(4);
  });

  it("applies only the selected conflicts", () => {
    const draft = build([0]);
    expect(draft.forbiddenClaimsKo).toEqual([FORBIDDEN_STOOL, FORBIDDEN_BROTH, FORBIDDEN_KEEP]);
    expect(draft.keyTakeawaysKo).toEqual([TAKEAWAY_STALE, TAKEAWAY_KEEP]);
    expect(draft.researchRevision?.addedEvidenceIds).toEqual([researchEvidenceId(IMPORT_ID, "F1")]);
  });

  it("never cites findings below corroborated", () => {
    const draft = build([1]);
    expect(draft.researchRevision?.addedEvidenceIds).toEqual([researchEvidenceId(IMPORT_ID, "F2")]);
  });

  it("no longer fails contradicted_claim_revived once the lifted claim is used in the body", () => {
    const draft = build([0, 1, 2, 3]);
    const withBody = { ...draft, bodyKo: `${draft.bodyKo} ${FORBIDDEN_BIB}이라 아침마다 줄이 깁니다.` };
    const before = { ...approvedAsset(), bodyKo: withBody.bodyKo };
    const codes = (asset: CanonicalMarketingAsset) =>
      validateCanonicalMarketingAsset({
        asset,
        storyPoint: { pointId: asset.storyPointId, storyClaim: "" } as never,
        storyPointHash: asset.storyPointHash,
        evidenceBrief: null,
        proposition: {} as never,
        expectedSourceRevision: asset.sourceRevision,
      }).issues.map((i) => i.code);
    expect(codes(before)).toContain("contradicted_claim_revived");
    expect(codes(withBody)).not.toContain("contradicted_claim_revived");
  });

  it("keeps evidence notes within the parser cap and survives a durable round-trip", () => {
    const longClaim = "가".repeat(400);
    const result = blockedResult();
    (result.research as { findings: unknown[] }).findings[0] = finding("F1", longClaim);
    const draft = build([0], approvedAsset(), externalCandidate({}, result));
    const note = draft.evidenceRefs.at(-1)?.noteKo ?? "";
    expect(note.length).toBeLessThanOrEqual(240);

    const parsed = parseDurableCanonicalMarketingAsset(JSON.parse(JSON.stringify(draft)));
    expect(parsed?.version).toBe(3);
    expect(parsed?.researchRevision).toEqual(draft.researchRevision);
    expect(parsed?.evidenceRefs.at(-1)?.noteKo).toBe(note);
  });

  it("caps evidenceRefs at 24 and never duplicates an existing research evidence id", () => {
    const existing = Array.from({ length: 22 }, (_, i) => ({ evidenceId: `ev${i}`, noteKo: "기존" }));
    existing.push({ evidenceId: researchEvidenceId(IMPORT_ID, "F1"), noteKo: "이미 인용" });
    const draft = build([0, 1, 2, 3], approvedAsset({ evidenceRefs: existing }));
    expect(draft.evidenceRefs).toHaveLength(24);
    expect(draft.researchRevision?.addedEvidenceIds).toEqual([researchEvidenceId(IMPORT_ID, "F2")]);
    expect(new Set(draft.evidenceRefs.map((e) => e.evidenceId)).size).toBe(24);
  });

  it("rejects when the canonical is not the approved version", () => {
    const err = draftError(() => build([0], approvedAsset({ status: "human_edited", approvedVersion: 1 })));
    expect(err.code).toBe("canonical_not_approved");
  });

  it("rejects a candidate made against a different canonical identity", () => {
    const staleCandidate = externalCandidate({ canonicalVersion: 1 });
    expect(candidateMatchesCanonical(staleCandidate, approvedAsset())).toBe(false);
    const err = draftError(() => build([0], approvedAsset(), staleCandidate));
    expect(err.code).toBe("stale_identity");
    expect(err.details).toEqual(["canonicalVersion"]);

    const otherCandidate = draftError(() =>
      buildCanonicalDraftFromResearch({
        asset: approvedAsset(),
        candidate: externalCandidate(),
        candidateId: "cmc_other",
        conflictIndexes: [0],
        now: NOW,
        appliedBy: null,
      }),
    );
    expect(otherCandidate.details).toEqual(["candidateId"]);
  });

  it("rejects manual, missing, or unknown conflict selections and empty selections", () => {
    const result = blockedResult([
      { canonicalField: "bodyKo", canonicalText: "구시가지", findingIds: ["F4"], explanation: "" },
      { canonicalField: "forbiddenClaimsKo", canonicalText: "없는 문구", findingIds: [], explanation: "" },
    ]);
    const candidate = externalCandidate({}, result);
    expect(draftError(() => build([0], approvedAsset(), candidate)).code).toBe("invalid_conflict_selection");
    expect(draftError(() => build([1], approvedAsset(), candidate)).code).toBe("invalid_conflict_selection");
    expect(draftError(() => build([9])).code).toBe("invalid_conflict_selection");
    expect(draftError(() => build([])).code).toBe("no_applicable_conflicts");
  });

  it("refuses to empty keyTakeawaysKo", () => {
    const result = blockedResult([
      { canonicalField: "keyTakeawaysKo", canonicalText: TAKEAWAY_STALE, findingIds: ["F1"], explanation: "" },
      { canonicalField: "keyTakeawaysKo", canonicalText: TAKEAWAY_KEEP, findingIds: ["F4"], explanation: "" },
    ]);
    const err = draftError(() => build([0, 1], approvedAsset(), externalCandidate({}, result)));
    expect(err.code).toBe("takeaways_would_be_empty");
  });
});

describe("applyExternalResearchToCanonicalAsset", () => {
  const tempDirs: string[] = [];
  const priorRoot = process.env.MARKETING_ASSET_ROOT;

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
    if (priorRoot === undefined) delete process.env.MARKETING_ASSET_ROOT;
    else process.env.MARKETING_ASSET_ROOT = priorRoot;
  });

  function candidateStub(asset: CanonicalMarketingAsset): CompletedMarketingCandidate {
    return {
      candidateId: CANDIDATE_ID,
      businessDateKst: "2026-09-19",
      logicalRunKey: "lrk_pho",
      runId: "run_pho",
      status: "needs_human_review",
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:00:00.000Z",
      contract: "completed-marketing-candidate-v1",
      contentAssignment: {
        assignmentId: "ca_pho",
        topic: "하노이 쌀국수",
        audience: "하노이 여행 예정자",
        commercialIntent: "informational",
        evidenceRefs: [],
        facts: [],
      },
      contentPlan: {
        keyMessage: "쌀국수",
        hook: null,
        targetChannels: CHANNELS,
        recommendedFormats: [],
        factsToAvoid: [],
        evidenceRefs: [],
      },
      selectedAgenda: {
        id: "ag_hanoi",
        title: "하노이",
        destinations: ["하노이"],
        entities: [],
        summary: "요약",
        timelinessNote: null,
        evidenceRefs: [],
      },
      governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
      draft: { title: "t", body: "b", channel: "threads" },
      provenance: { governanceReviewId: "gov_pho" },
      canonicalMarketingAsset: asset,
    } as unknown as CompletedMarketingCandidate;
  }

  it("snapshots v2, persists the v3 draft to package and candidate, and leaves External candidates intact", async () => {
    const assetRoot = mkdtempSync(join(tmpdir(), "research-draft-"));
    tempDirs.push(assetRoot);
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "19", CANDIDATE_ID);
    mkdirSync(join(packageRoot, "context"), { recursive: true });

    const approved = approvedAsset();
    persistCanonicalAssetToPackage({ packageRoot, asset: approved });
    const candidateRef = persistExternalEditorialCandidate({ packageRoot, candidate: externalCandidate() });
    const candidateBytes = readFileSync(join(packageRoot, candidateRef), "utf8");
    const repo = createInMemoryDailyMarketingRunRepository();
    const candidate = candidateStub(approved);
    await repo.saveCandidate(candidate);

    const result = await applyExternalResearchToCanonicalAsset({
      candidate,
      runRepo: repo,
      importId: IMPORT_ID,
      conflictIndexes: [0, 1, 2, 3],
      appliedBy: "ysh",
      now: NOW,
    });

    expect(result.asset.version).toBe(3);
    expect(result.asset.status).toBe("human_edited");
    expect(result.snapshotRef.startsWith(`${CANONICAL_HISTORY_DIRECTORY}/v2-`)).toBe(true);

    const snapshot = JSON.parse(readFileSync(join(packageRoot, result.snapshotRef), "utf8"));
    expect(snapshot.version).toBe(2);
    expect(snapshot.status).toBe("approved");
    expect(snapshot.forbiddenClaimsKo).toHaveLength(4);
    expect(readdirSync(join(packageRoot, CANONICAL_HISTORY_DIRECTORY))).toHaveLength(1);

    const onDisk = readCanonicalAssetFromPackage(packageRoot);
    expect(onDisk?.version).toBe(3);
    expect(onDisk?.forbiddenClaimsKo).toEqual([FORBIDDEN_KEEP]);
    expect(onDisk?.researchRevision?.importId).toBe(IMPORT_ID);

    const saved = await repo.findCandidateByCandidateId(CANDIDATE_ID);
    expect(saved?.canonicalMarketingAsset?.version).toBe(3);
    expect(result.candidate.canonicalMarketingAsset?.version).toBe(3);

    expect(readFileSync(join(packageRoot, candidateRef), "utf8")).toBe(candidateBytes);

    const approvedV3 = await approveCanonicalAsset({
      candidate: result.candidate,
      runRepo: repo,
      mode: "human_edited",
      approvedBy: "ysh",
      now: new Date("2026-09-29T04:00:00.000Z"),
    });
    expect(approvedV3.asset.status).toBe("approved");
    expect(approvedV3.asset.approvedVersion).toBe(3);

    const staleAgain = draftError(() =>
      buildCanonicalDraftFromResearch({
        asset: approvedV3.asset,
        candidate: externalCandidate(),
        candidateId: CANDIDATE_ID,
        conflictIndexes: [0],
        now: NOW,
        appliedBy: "ysh",
      }),
    );
    expect(staleAgain.code).toBe("stale_identity");
  });

  it("fails without writing a snapshot when the External candidate is stale", async () => {
    const assetRoot = mkdtempSync(join(tmpdir(), "research-draft-"));
    tempDirs.push(assetRoot);
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "19", CANDIDATE_ID);
    mkdirSync(join(packageRoot, "context"), { recursive: true });

    const approved = approvedAsset({ version: 3, approvedVersion: 3 });
    persistCanonicalAssetToPackage({ packageRoot, asset: approved });
    persistExternalEditorialCandidate({ packageRoot, candidate: externalCandidate() });
    const repo = createInMemoryDailyMarketingRunRepository();
    const candidate = candidateStub(approved);
    await repo.saveCandidate(candidate);

    await expect(
      applyExternalResearchToCanonicalAsset({
        candidate,
        runRepo: repo,
        importId: IMPORT_ID,
        conflictIndexes: [0],
        appliedBy: "ysh",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "stale_identity" });
    expect(existsSync(join(packageRoot, CANONICAL_HISTORY_DIRECTORY))).toBe(false);
    expect(readCanonicalAssetFromPackage(packageRoot)?.version).toBe(3);
  });
});
