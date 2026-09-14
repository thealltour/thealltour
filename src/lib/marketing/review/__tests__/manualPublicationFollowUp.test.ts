import { describe, expect, it, vi } from "vitest";

import {
  runManualPublicationFollowUp,
  type ManualPublicationFollowUpDeps,
} from "@/lib/marketing/review/manualPublicationFollowUp";
import type { HumanMarketingReview, ManualPublicationRecord } from "@/lib/marketing/review/types";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

function review(manualPublication: ManualPublicationRecord | null): HumanMarketingReview {
  return {
    contract: "human-marketing-review-v1",
    reviewId: "hmr_1",
    candidateId: "cmc_1",
    runId: "run_1",
    status: "manually_published",
    manualPublication,
  } as unknown as HumanMarketingReview;
}

const candidate = { candidateId: "cmc_1" } as unknown as CompletedMarketingCandidate;

function deps(overrides: Partial<ManualPublicationFollowUpDeps> = {}): ManualPublicationFollowUpDeps {
  return {
    recordPublication: vi.fn(async () => ({
      publicationId: "pub_1",
      created: true,
      review: review({ socialAccountId: "acc_1" }),
    })),
    loadCandidate: vi.fn(async () => candidate),
    collectPerformance: vi.fn(async () => ({
      snapshotId: "snap_1",
      status: "success",
      idempotentReuse: false,
    })),
    ...overrides,
  };
}

const complete: ManualPublicationRecord = {
  socialAccountId: "acc_1",
  platform: "threads",
  channel: "threads",
  externalUrl: "https://www.threads.net/@theall/post/1",
  publishedAt: "2026-09-14T02:00:00.000Z",
};

describe("manual publication follow-up", () => {
  it("records the publication bridge entry and a performance snapshot", async () => {
    const d = deps();
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: d,
    });

    expect(result.steps).toEqual([
      { step: "publication_bridge", status: "recorded", reason: null, ref: "pub_1" },
      { step: "performance_snapshot", status: "recorded", reason: null, ref: "snap_1" },
    ]);
    expect(d.recordPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        socialAccountId: "acc_1",
        channel: "threads",
        externalUrl: "https://www.threads.net/@theall/post/1",
        publishedAt: "2026-09-14T02:00:00.000Z",
      }),
    );
  });

  it("still collects performance when no social account is registered", async () => {
    const d = deps();
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review({ platform: "naver_band", publishedAt: "2026-09-14T02:00:00.000Z" }),
      deps: d,
    });

    expect(result.steps[0]).toEqual({
      step: "publication_bridge",
      status: "skipped",
      reason: "social_account_not_provided",
      ref: null,
    });
    expect(result.steps[1]!.status).toBe("recorded");
    expect(d.recordPublication).not.toHaveBeenCalled();
  });

  it("skips the bridge without external evidence", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review({ socialAccountId: "acc_1", publishedAt: "2026-09-14T02:00:00.000Z" }),
      deps: deps(),
    });
    expect(result.steps[0]!.reason).toBe("external_evidence_missing");
  });

  it("keeps a bridge failure from stopping the snapshot", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({
        recordPublication: vi.fn(async () => {
          throw new Error("social account inactive");
        }),
      }),
    });
    expect(result.steps[0]).toEqual({
      step: "publication_bridge",
      status: "failed",
      reason: "social account inactive",
      ref: null,
    });
    expect(result.steps[1]!.status).toBe("recorded");
  });

  it("reports a metrics failure without throwing", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({
        collectPerformance: vi.fn(async () => {
          throw new Error("adapter timeout");
        }),
      }),
    });
    expect(result.steps[1]).toEqual({
      step: "performance_snapshot",
      status: "failed",
      reason: "adapter timeout",
      ref: null,
    });
  });

  it("reports the eligibility status when no snapshot was produced", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({
        collectPerformance: vi.fn(async () => ({
          snapshotId: null,
          status: "unsupported_provider",
          idempotentReuse: false,
        })),
      }),
    });
    expect(result.steps[1]).toEqual({
      step: "performance_snapshot",
      status: "skipped",
      reason: "unsupported_provider",
      ref: null,
    });
  });

  it("marks reuse instead of a new record on a repeat call", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({
        recordPublication: vi.fn(async () => ({
          publicationId: "pub_1",
          created: false,
          review: review(complete),
        })),
        collectPerformance: vi.fn(async () => ({
          snapshotId: "snap_1",
          status: "success",
          idempotentReuse: true,
        })),
      }),
    });
    expect(result.steps.map((step) => step.status)).toEqual(["reused", "reused"]);
  });

  it("passes the bridge-updated review to the metrics collector", async () => {
    const updated = review({ ...complete, notes: "bridge normalized" });
    const collectPerformance = vi.fn(async () => ({
      snapshotId: "snap_1",
      status: "success",
      idempotentReuse: false,
    }));
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({
        recordPublication: vi.fn(async () => ({
          publicationId: "pub_1",
          created: true,
          review: updated,
        })),
        collectPerformance,
      }),
    });
    expect(collectPerformance).toHaveBeenCalledWith(expect.objectContaining({ review: updated }));
    expect(result.review).toBe(updated);
  });

  it("skips the snapshot when the candidate is gone", async () => {
    const result = await runManualPublicationFollowUp({
      candidateId: "cmc_1",
      review: review(complete),
      deps: deps({ loadCandidate: vi.fn(async () => null) }),
    });
    expect(result.steps[1]!.reason).toBe("candidate_not_found");
  });
});
