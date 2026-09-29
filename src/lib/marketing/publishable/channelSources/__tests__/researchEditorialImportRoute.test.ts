vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHumanReviewDetail: vi.fn(),
  getOrCreateHumanReview: vi.fn(),
  importExternalEditorialResult: vi.fn(),
  applyExternalCandidateToAllChannels: vi.fn(),
  repoUpdate: vi.fn(),
}));

vi.mock("@/lib/apiAuth", () => ({
  requireAdminPermission: vi.fn(async () => ({
    ok: true,
    session: { username: "ysh", adminUserId: "admin_1" },
  })),
}));
vi.mock("@/lib/marketing/review/humanMarketingReviewService", () => ({
  createHumanMarketingReviewService: async () => ({
    getHumanReviewDetail: mocks.getHumanReviewDetail,
    getOrCreateHumanReview: mocks.getOrCreateHumanReview,
  }),
}));
vi.mock("@/lib/marketing/review/repository/createHumanMarketingReviewRepository", () => ({
  createHumanMarketingReviewRepository: async () => ({ update: mocks.repoUpdate }),
}));
vi.mock("@/lib/marketing/canonicalAsset/applyExternalResearchConflicts", () => ({
  readExternalResearchSummary: (result: { research?: { status?: string } }) =>
    result.research ? { status: result.research.status } : null,
}));
vi.mock("@/lib/marketing/canonicalAsset/persistence", () => ({
  resolveCanonicalMarketingAsset: () => ({ assetId: "cma_1", version: 3, status: "approved", approvedVersion: 3 }),
}));
vi.mock("@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource", () => ({
  resolveCandidatePackageRoot: () => "/pkg",
}));
vi.mock("@/lib/marketing/publishable/channelSources", () => ({
  ExternalEditorialCandidateExistsError: class extends Error {},
  importExternalEditorialResult: mocks.importExternalEditorialResult,
  applyExternalCandidateToAllChannels: mocks.applyExternalCandidateToAllChannels,
}));

import { POST } from "@/app/api/admin/marketing-review/[candidateId]/research-editorial-import/route";

const REVIEW = { reviewId: "rev_1", candidateId: "cmc_1", channelReviews: {} };

function post(raw = "{}") {
  return POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ raw }) }), {
    params: Promise.resolve({ candidateId: "cmc_1" }),
  });
}

function imported(status: string) {
  return {
    ok: true,
    candidateRef: "context/channel-sources/external-editorial/xe_1.json",
    candidate: {
      importId: "xe_1",
      importedAt: "2026-09-29T00:00:00.000Z",
      warnings: ["research.status가 blocked이지만 채널 결과를 그대로 가져옵니다."],
      channelReadiness: {},
      result: { research: { status } },
    },
  };
}

describe("research-editorial-import POST auto-apply", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.getHumanReviewDetail.mockResolvedValue({ candidate: { candidateId: "cmc_1" }, review: REVIEW });
    mocks.repoUpdate.mockImplementation(async (review: unknown) => ({ ...(review as object), persisted: true }));
  });

  it("imports a blocked result and applies every channel it carries, persisting the review", async () => {
    mocks.importExternalEditorialResult.mockReturnValue(imported("blocked"));
    mocks.applyExternalCandidateToAllChannels.mockReturnValue({
      review: { ...REVIEW, updatedAt: "now" },
      reviewChanged: true,
      applied: ["threads", "instagram"],
      failed: [],
      warnings: ["threads: threads 정책 경고: too_long(길이)"],
    });

    const res = await post();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.researchStatus).toBe("blocked");
    expect(json.appliedChannels).toEqual(["threads", "instagram"]);
    expect(json.message).toContain("Threads, Instagram 채널에 바로 적용했습니다");
    expect(json.warnings).toHaveLength(2);
    expect(json.review.persisted).toBe(true);
    expect(mocks.applyExternalCandidateToAllChannels).toHaveBeenCalledWith(
      expect.objectContaining({ packageRoot: "/pkg", candidateId: "cmc_1", importId: "xe_1", review: REVIEW }),
    );
    expect(mocks.repoUpdate).toHaveBeenCalledTimes(1);
  });

  it("creates the review when missing and tells the operator to rerun when no channels came back", async () => {
    mocks.getHumanReviewDetail.mockResolvedValue({ candidate: { candidateId: "cmc_1" }, review: null });
    mocks.getOrCreateHumanReview.mockResolvedValue(REVIEW);
    mocks.importExternalEditorialResult.mockReturnValue(imported("blocked"));
    mocks.applyExternalCandidateToAllChannels.mockReturnValue({
      review: REVIEW,
      reviewChanged: false,
      applied: [],
      failed: [],
      warnings: [],
    });

    const json = await (await post()).json();
    expect(mocks.getOrCreateHumanReview).toHaveBeenCalledWith("cmc_1", "ysh");
    expect(json.message).toContain("다시 실행하세요");
    expect(mocks.repoUpdate).not.toHaveBeenCalled();
  });

  it("still returns 409 for a result that belongs to another candidate", async () => {
    mocks.importExternalEditorialResult.mockReturnValue({
      ok: false,
      code: "stale_identity",
      messageKo: "다른 후보",
      details: ["candidateId"],
    });
    const res = await post();
    expect(res.status).toBe(409);
    expect(mocks.applyExternalCandidateToAllChannels).not.toHaveBeenCalled();
  });
});
