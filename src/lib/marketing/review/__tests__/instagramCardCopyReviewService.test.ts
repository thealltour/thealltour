vi.mock("server-only", () => ({}));

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  readInstagramCardCopyReviewFromPackage,
  resolveInstagramCardCopyReviewGate,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import {
  INSTAGRAM_CARD_COPY_CONTRACT,
  type InstagramCardCopy,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { persistInstagramCardCopy } from "@/lib/marketing/publishable/instagramEditorial/persist";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

const CANDIDATE_ID = "cand_card_review_svc";
const T0 = "2026-09-27T00:00:00.000Z";

function cardCopy(firstHeadline = "AI 표지"): InstagramCardCopy {
  return {
    contract: INSTAGRAM_CARD_COPY_CONTRACT,
    assetId: "cma_1",
    assetVersion: 1,
    cards: [
      { cardId: "c1", headline: firstHeadline, body: "AI 본문 1" },
      { cardId: "c2", headline: "AI 두번째", body: "AI 본문 2", evidenceRefs: ["ev-1"] },
    ],
    sourceCarouselFingerprint: "carousel_fp",
    provenance: {
      sourceAssetId: "cma_1",
      sourceVersion: 1,
      modelProfile: "test",
      generatedAt: T0,
      sourceUpstreamFingerprint: "carousel_fp",
    },
  } as InstagramCardCopy;
}

let packageRoot: string;
let service: HumanMarketingReviewService;
let reviewRepo: ReturnType<typeof createInMemoryHumanMarketingReviewRepository>;

beforeEach(async () => {
  packageRoot = mkdtempSync(join(tmpdir(), "ig-card-review-svc-"));
  mkdirSync(join(packageRoot, "context"), { recursive: true });
  persistInstagramCardCopy({ packageRoot, copy: cardCopy(), createdAt: T0 });

  const candidate = {
    candidateId: CANDIDATE_ID,
    businessDateKst: "2026-09-27",
    status: "ready_for_human_review",
  } as CompletedMarketingCandidate;
  reviewRepo = createInMemoryHumanMarketingReviewRepository();
  await reviewRepo.save({
    reviewId: "rev_svc",
    candidateId: CANDIDATE_ID,
    status: "editing",
    channelReviews: {},
    updatedAt: T0,
  } as unknown as HumanMarketingReview);
  service = new HumanMarketingReviewService({
    candidateRepo: {
      findCandidateByCandidateId: async (id: string) => (id === CANDIDATE_ID ? candidate : null),
    } as unknown as DailyMarketingRunRepository,
    reviewRepo,
    now: () => new Date("2026-09-27T05:00:00.000Z"),
    resolvePackageRoot: () => packageRoot,
  });
});

afterEach(() => {
  rmSync(packageRoot, { recursive: true, force: true });
});

describe("HumanMarketingReviewService — Instagram card copy review", () => {
  it("offers an unsaved AI draft first, then saves to DB and package as pending", async () => {
    const initial = await service.getInstagramCardCopyReview(CANDIDATE_ID);
    expect(initial).toMatchObject({ applicable: true, gateState: "review_missing", persisted: false });
    expect(initial.review!.cards.map((c) => c.aiDraft.headline)).toEqual(["AI 표지", "AI 두번째"]);

    const saved = await service.saveInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cards: [{ cardId: "c2", headline: "사람 두번째", body: "사람 본문" }],
      reviewedBy: "ysh",
    });
    expect(saved).toMatchObject({ gateState: "pending", persisted: true });
    const stored = (await reviewRepo.findByCandidateId(CANDIDATE_ID))!.channelReviews!.instagram!;
    expect(stored.cardCopyReview!.cards[1]!.humanDraft!.headline).toBe("사람 두번째");
    expect(stored.cardCopyReview!.cards[1]!.evidenceRefs).toEqual(["ev-1"]);
    expect(stored.status).toBe("needs_review");
    expect(readInstagramCardCopyReviewFromPackage(packageRoot)).toEqual(stored.cardCopyReview);
  });

  it("approval unblocks the gate; a later save re-blocks it", async () => {
    await service.saveInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cards: [{ cardId: "c1", headline: "사람 표지" }],
      reviewedBy: "ysh",
    });
    const approved = await service.approveInstagramCardCopyReview({ candidateId: CANDIDATE_ID, reviewedBy: "ysh" });
    expect(approved.gateState).toBe("approved");
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("approved");
    const entry = (await reviewRepo.findByCandidateId(CANDIDATE_ID))!.channelReviews!.instagram!;
    expect(entry.status).toBe("needs_review");
    expect(entry.approvedAt).toBeNull();

    await service.saveInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cards: [{ cardId: "c1", headline: "다시 고친 표지" }],
      reviewedBy: "ysh",
    });
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("pending");
  });

  it("approves the AI copy as-is when no edits were made", async () => {
    const approved = await service.approveInstagramCardCopyReview({ candidateId: CANDIDATE_ID, reviewedBy: "ysh" });
    expect(approved.gateState).toBe("approved");
  });

  it("refuses carry-over approval without edits or without a VRA planned for the generated copy", async () => {
    await expect(
      service.approveInstagramCardCopyReview({
        candidateId: CANDIDATE_ID,
        reviewedBy: "ysh",
        keepExistingVisuals: true,
      }),
    ).rejects.toMatchObject({ code: "visual_carry_over_unavailable" });

    await service.saveInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cards: [{ cardId: "c1", headline: "사람 표지" }],
      reviewedBy: "ysh",
    });
    await expect(
      service.approveInstagramCardCopyReview({
        candidateId: CANDIDATE_ID,
        reviewedBy: "ysh",
        keepExistingVisuals: true,
      }),
    ).rejects.toMatchObject({ code: "visual_carry_over_unavailable" });
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("pending");
  });

  it("refuses to drop edits made on an older generated copy until reset", async () => {
    await service.saveInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cards: [{ cardId: "c1", headline: "사람 표지" }],
      reviewedBy: "ysh",
    });
    persistInstagramCardCopy({ packageRoot, copy: cardCopy("재생성된 표지"), createdAt: T0 });

    const view = await service.getInstagramCardCopyReview(CANDIDATE_ID);
    expect(view).toMatchObject({ gateState: "base_changed", staleHumanEdits: true, persisted: false });
    await expect(
      service.approveInstagramCardCopyReview({ candidateId: CANDIDATE_ID, reviewedBy: "ysh" }),
    ).rejects.toMatchObject({ code: "base_changed" });

    const reset = await service.resetInstagramCardCopyReview({ candidateId: CANDIDATE_ID, reviewedBy: "ysh" });
    expect(reset).toMatchObject({ gateState: "pending", staleHumanEdits: false });
    expect(reset.review!.cards[0]).toMatchObject({ humanDraft: null, aiDraft: { headline: "재생성된 표지" } });
  });
});
