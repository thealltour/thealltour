vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyExternalResearchToCanonicalAsset: vi.fn(),
  getHumanReviewDetail: vi.fn(),
  resolveCanonicalMarketingAsset: vi.fn(),
  listExternalEditorialCandidates: vi.fn(),
}));

vi.mock("@/lib/apiAuth", () => ({
  requireAdminPermission: vi.fn(async () => ({
    ok: true,
    session: { username: "ysh", adminUserId: "admin_1" },
  })),
}));
vi.mock("@/lib/marketing/review/humanMarketingReviewService", () => ({
  createHumanMarketingReviewService: async () => ({ getHumanReviewDetail: mocks.getHumanReviewDetail }),
}));
vi.mock("@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository", () => ({
  createDailyMarketingRunRepository: async () => ({}),
}));
vi.mock("@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository", () => ({
  createMarketingProductionRequestRepository: async () => ({}),
}));
vi.mock("@/lib/marketing/canonicalAsset/approveAndGenerateChannels", () => ({
  applyExternalResearchToCanonicalAsset: mocks.applyExternalResearchToCanonicalAsset,
  approveCanonicalAsset: vi.fn(),
  saveCanonicalAssetHumanEdit: vi.fn(),
}));
vi.mock("@/lib/marketing/canonicalAsset/regenerateCanonicalMarketingAsset", () => ({
  regenerateCanonicalMarketingAsset: vi.fn(),
}));
vi.mock("@/lib/marketing/cron/marketingCronRuntime", () => ({
  createAssetSourceWriterInvoke: vi.fn(),
  createMarketingCronCorrelationId: vi.fn(),
  createPublishableComposerInvoke: vi.fn(),
  isAiRuntimeMarketingCronEnabled: () => false,
}));
vi.mock("@/lib/marketing/cron/marketingPlanSpecialists", () => ({
  MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT: 1000,
}));
vi.mock("@/lib/marketing/cron/invokeHermesProfileAsync", () => ({ invokeHermesProfileAsync: vi.fn() }));
vi.mock("@/ai-runtime/integration/runtime-stack", () => ({ createRuntimeExecutorStack: vi.fn() }));
vi.mock("@/ai-runtime/observability/persistence", () => ({ ensureSharedObservabilityRecorder: vi.fn() }));
vi.mock("@/lib/marketing/canonicalAsset/persistence", () => ({
  resolveCanonicalMarketingAsset: mocks.resolveCanonicalMarketingAsset,
}));
vi.mock("@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource", () => ({
  resolveCandidatePackageRoot: () => "/pkg",
}));
vi.mock("@/lib/marketing/publishable/channelSources", () => ({
  listChannelSourceViews: () => [],
  listExternalEditorialCandidates: mocks.listExternalEditorialCandidates,
  selectChannelSource: vi.fn(),
}));

import { ExternalResearchDraftError } from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";
import { POST as canonicalAssetPost } from "@/app/api/admin/marketing-review/[candidateId]/canonical-asset/route";
import { GET as channelSourceGet } from "@/app/api/admin/marketing-review/[candidateId]/channel-source-selection/route";

const CONTEXT = { params: Promise.resolve({ candidateId: "cmc_1" }) };

function post(body: unknown) {
  return canonicalAssetPost(
    new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ candidateId: "cmc_1" }) },
  );
}

const CANONICAL = {
  assetId: "cma_1",
  version: 2,
  status: "approved",
  approvedVersion: 2,
  sourceRevision: "src_1",
  forbiddenClaimsKo: ["미쉐린 선정 단정"],
  keyTakeawaysKo: ["요점"],
  limitationsKo: [],
  unresolvedQuestionsKo: [],
};

function external(canonicalVersion: number) {
  return {
    importId: `xe_179066467942${canonicalVersion}_09c87ca6b0`,
    importedAt: "2026-09-29T00:00:00.000Z",
    importedBy: "ysh",
    candidateId: "cmc_1",
    assetId: "cma_1",
    canonicalVersion,
    sourceRevision: "src_1",
    warnings: [],
    channelReadiness: {},
    result: {
      research: {
        status: "blocked",
        findings: [],
        unresolved: [],
        canonicalConflicts: [
          { canonicalField: "forbiddenClaimsKo", canonicalText: "미쉐린 선정 단정", findingIds: [], explanation: "" },
        ],
      },
    },
  };
}

describe("canonical-asset apply_research_conflicts", () => {
  beforeEach(() => {
    mocks.applyExternalResearchToCanonicalAsset.mockReset();
    mocks.getHumanReviewDetail.mockReset();
    mocks.getHumanReviewDetail.mockResolvedValue({ candidate: { candidateId: "cmc_1" }, review: null });
  });

  it("requires importId and at least one conflict index", async () => {
    expect((await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [] })).status).toBe(400);
    expect((await post({ action: "apply_research_conflicts", conflictIndexes: [0] })).status).toBe(400);
    expect((await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [-1] })).status).toBe(
      400,
    );
    expect(mocks.applyExternalResearchToCanonicalAsset).not.toHaveBeenCalled();
  });

  it("creates the draft and returns the new version", async () => {
    mocks.applyExternalResearchToCanonicalAsset.mockResolvedValue({
      candidate: { candidateId: "cmc_1" },
      asset: { assetId: "cma_1", version: 3, status: "human_edited", researchRevision: { importId: "xe_1" } },
      snapshotRef: "context/canonical-history/v2-x.json",
    });
    const res = await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [0, 2] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.asset.version).toBe(3);
    expect(json.snapshotRef).toBe("context/canonical-history/v2-x.json");
    expect(mocks.applyExternalResearchToCanonicalAsset).toHaveBeenCalledWith(
      expect.objectContaining({ importId: "xe_1", conflictIndexes: [0, 2], appliedBy: "ysh" }),
    );
  });

  it("maps draft errors to stale / 422 / 404", async () => {
    mocks.applyExternalResearchToCanonicalAsset.mockRejectedValueOnce(
      new ExternalResearchDraftError("stale_identity", "이전 승인본 기준", ["canonicalVersion"]),
    );
    const stale = await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [0] });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("stale");

    mocks.applyExternalResearchToCanonicalAsset.mockRejectedValueOnce(
      new ExternalResearchDraftError("takeaways_would_be_empty", "요점 비움"),
    );
    const empty = await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [0] });
    expect(empty.status).toBe(422);
    expect((await empty.json()).code).toBe("takeaways_would_be_empty");

    mocks.applyExternalResearchToCanonicalAsset.mockRejectedValueOnce(
      new ExternalResearchDraftError("invalid_conflict_selection", "선택 오류", ["conflict#4"]),
    );
    expect((await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [4] })).status).toBe(
      422,
    );

    mocks.applyExternalResearchToCanonicalAsset.mockRejectedValueOnce(new Error("external_candidate_missing"));
    expect((await post({ action: "apply_research_conflicts", importId: "xe_1", conflictIndexes: [0] })).status).toBe(
      404,
    );
  });
});

describe("channel-source-selection GET research summary", () => {
  it("returns research, canonical approval, and per-candidate stale flags", async () => {
    mocks.getHumanReviewDetail.mockResolvedValue({ candidate: { candidateId: "cmc_1" }, review: null });
    mocks.resolveCanonicalMarketingAsset.mockReturnValue(CANONICAL);
    mocks.listExternalEditorialCandidates.mockReturnValue([external(2), external(1)]);

    const res = await channelSourceGet(new Request("http://localhost/x"), CONTEXT);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canonical).toEqual({ version: 2, status: "approved", approved: true });
    expect(json.candidates.map((c: { stale: boolean }) => c.stale)).toEqual([false, true]);
    expect(json.candidates[0].research.status).toBe("blocked");
    expect(json.candidates[0].research.conflicts[0].action).toBe("remove_forbidden");
  });
});
