import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { bootstrapHumanReviewForCandidate } from "@/lib/marketing/review/bootstrap/bootstrapHumanReview";
import {
  HumanReviewEligibilityError,
  type HumanReviewIneligibilityReason,
} from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";
import { filterQueueItems, toQueueItem } from "@/lib/marketing/review/dto";
import {
  buildMorningMarketingReviewContext,
  buildMorningReviewQueueSummary,
} from "@/lib/marketing/review/morningReview/buildMorningReviewContext";
import type {
  MorningMarketingReviewContext,
  MorningReviewQueueSummary,
} from "@/lib/marketing/review/morningReview/types";
import { isVerificationRecord } from "@/lib/marketing/operations/verification";
import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import {
  assertAllowedTransition,
  assertCandidateApprovable,
  canCandidateBeApproved,
  computeGovernanceStale,
  isCandidateBlocked,
  isCandidateDiagnosticsOnly,
} from "@/lib/marketing/review/transitions";
import type {
  HumanMarketingReview,
  HumanReviewDetail,
  HumanReviewDraft,
  HumanReviewQueueFilter,
  HumanReviewQueueItem,
  ManualPublicationRecord,
} from "@/lib/marketing/review/types";

export type HumanMarketingReviewServiceDeps = {
  candidateRepo: DailyMarketingRunRepository;
  reviewRepo: HumanMarketingReviewRepository;
  now?: () => Date;
};

function buildDetail(
  candidate: NonNullable<Awaited<ReturnType<DailyMarketingRunRepository["findCandidateByCandidateId"]>>>,
  review: HumanMarketingReview | null,
): HumanReviewDetail {
  const diagnosticsOnly = isCandidateDiagnosticsOnly(candidate.status);
  const blocked = isCandidateBlocked(candidate.status);
  const approvable = canCandidateBeApproved(candidate.status);
  const humanStatus = review?.status ?? null;
  const governanceStale = review?.humanEditedAfterGovernance ?? false;

  const canEdit =
    !diagnosticsOnly &&
    humanStatus !== "rejected" &&
    humanStatus !== "manually_published" &&
    (!blocked || humanStatus === "editing" || humanStatus === "pending");

  return {
    candidate,
    review,
    canApprove:
      approvable &&
      !diagnosticsOnly &&
      !blocked &&
      (humanStatus === null ||
        humanStatus === "pending" ||
        humanStatus === "editing" ||
        humanStatus === "deferred"),
    canEdit,
    canDefer:
      !diagnosticsOnly &&
      !blocked &&
      (humanStatus === "pending" || humanStatus === "editing" || humanStatus === null),
    canReject:
      !diagnosticsOnly &&
      humanStatus !== "rejected" &&
      humanStatus !== "manually_published",
    canMarkManuallyPublished: humanStatus === "approved_for_manual_publish",
    governanceStale,
    diagnosticsOnly,
  };
}

export class HumanMarketingReviewService {
  constructor(private readonly deps: HumanMarketingReviewServiceDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  async listHumanReviewQueue(filter: HumanReviewQueueFilter = "all"): Promise<{
    items: HumanReviewQueueItem[];
    todayCandidate: HumanReviewQueueItem | null;
    pendingCount: number;
  }> {
    const [candidates, reviews] = await Promise.all([
      this.deps.candidateRepo.listCandidates({ limit: 100 }),
      this.deps.reviewRepo.listReviews({ limit: 100 }),
    ]);
    const reviewByCandidate = new Map(reviews.map((review) => [review.candidateId, review]));
    const items = candidates.map((candidate) =>
      toQueueItem({ candidate, review: reviewByCandidate.get(candidate.candidateId) ?? null }),
    );
    const filtered = filterQueueItems(items, filter, this.now());
    const productionItems = items.filter(
      (item) =>
        !isVerificationRecord({
          routineId: item.logicalRunKey.split(":")[0] ?? null,
          candidateId: item.candidateId,
          logicalRunKey: item.logicalRunKey,
        }),
    );
    const todayKst = formatKstBusinessDate(this.now());
    const todayCandidate = productionItems.find((item) => item.businessDateKst === todayKst) ?? null;
    const pendingCount = productionItems.filter((item) => item.actionNeeded).length;
    return { items: filtered, todayCandidate, pendingCount };
  }

  async getHumanReviewDetail(candidateId: string): Promise<HumanReviewDetail | null> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(candidateId);
    if (!candidate) return null;
    const review = await this.deps.reviewRepo.findByCandidateId(candidateId);
    return buildDetail(candidate, review);
  }

  async getMorningMarketingReviewContext(candidateId: string): Promise<MorningMarketingReviewContext | null> {
    const detail = await this.getHumanReviewDetail(candidateId);
    if (!detail) return null;

    let performanceSnapshots: import("@/lib/marketing/performance/types").ContentPerformanceSnapshot[] = [];
    try {
      const { createContentPerformanceRepository } = await import(
        "@/lib/marketing/performance/repository/createContentPerformanceRepository"
      );
      const perfRepo = await createContentPerformanceRepository();
      performanceSnapshots = await perfRepo.findByCandidateId(candidateId);
    } catch {
      performanceSnapshots = [];
    }

    const run = await this.deps.candidateRepo.findRunByLogicalKey(detail.candidate.logicalRunKey);

    return buildMorningMarketingReviewContext({
      detail,
      run,
      performanceSnapshots,
      now: this.now(),
    });
  }

  async listMorningReviewQueue(filter: HumanReviewQueueFilter = "all"): Promise<MorningReviewQueueSummary> {
    const base = await this.listHumanReviewQueue(filter);
    const candidates = await this.deps.candidateRepo.listCandidates({ limit: 100 });
    const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
    return buildMorningReviewQueueSummary({
      items: base.items,
      todayCandidate: base.todayCandidate,
      pendingCount: base.pendingCount,
      candidatesById,
      now: this.now(),
    });
  }

  async getOrCreateHumanReview(candidateId: string, reviewedBy: string | null): Promise<HumanMarketingReview> {
    const existing = await this.deps.reviewRepo.findByCandidateId(candidateId);
    if (existing) return existing;

    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(candidateId);
    if (!candidate) {
      throw new Error("candidate_not_found");
    }

    const result = await bootstrapHumanReviewForCandidate(candidate, {
      reviewRepo: this.deps.reviewRepo,
      now: () => this.now(),
      includeVerification: true,
    });

    if (result.outcome === "skipped") {
      throw new HumanReviewEligibilityError({
        candidateId,
        reason: result.reason as HumanReviewIneligibilityReason,
        message: `candidate_not_eligible_for_human_review:${result.reason}`,
      });
    }
    if (result.outcome === "failed") {
      throw new Error(result.error);
    }

    const review = result.review;
    if (reviewedBy && !review.reviewedBy) {
      return this.deps.reviewRepo.update({
        ...review,
        reviewedBy,
        updatedAt: this.now().toISOString(),
      });
    }
    return review;
  }

  private async loadMutableReview(candidateId: string, reviewedBy: string | null): Promise<HumanMarketingReview> {
    return this.getOrCreateHumanReview(candidateId, reviewedBy);
  }

  async updateHumanDraft(input: {
    candidateId: string;
    draft: HumanReviewDraft;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");
    if (isCandidateDiagnosticsOnly(candidate.status)) {
      throw new Error("diagnostics_only_candidate");
    }

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    if (review.status === "rejected" || review.status === "manually_published") {
      throw new Error("review_not_editable");
    }

    const nextStatus = review.status === "pending" ? "editing" : review.status;
    assertAllowedTransition(review.status, nextStatus);

    const humanEditedAfterGovernance = computeGovernanceStale(
      review.governanceReviewedDraftBody,
      input.draft.body,
    );

    const updated: HumanMarketingReview = {
      ...review,
      status: nextStatus,
      currentDraft: {
        title: input.draft.title ?? null,
        body: input.draft.body,
        channel: input.draft.channel || candidate.draft.channel,
      },
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      humanEditedAfterGovernance,
      updatedAt: this.now().toISOString(),
    };
    return this.deps.reviewRepo.update(updated);
  }

  async approveForManualPublish(input: {
    candidateId: string;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");
    assertCandidateApprovable(candidate.status);

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    assertAllowedTransition(review.status, "approved_for_manual_publish");

    const updated: HumanMarketingReview = {
      ...review,
      status: "approved_for_manual_publish",
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      approvedAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };
    return this.deps.reviewRepo.update(updated);
  }

  async deferHumanReview(input: {
    candidateId: string;
    humanNotes?: string | null;
    deferredUntil?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");
    if (isCandidateDiagnosticsOnly(candidate.status)) throw new Error("diagnostics_only_candidate");

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    assertAllowedTransition(review.status, "deferred");

    const updated: HumanMarketingReview = {
      ...review,
      status: "deferred",
      humanNotes: input.humanNotes ?? review.humanNotes,
      deferredUntil: input.deferredUntil ?? null,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      updatedAt: this.now().toISOString(),
    };
    return this.deps.reviewRepo.update(updated);
  }

  async rejectHumanReview(input: {
    candidateId: string;
    rejectionReason: string;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    assertAllowedTransition(review.status, "rejected");

    const updated: HumanMarketingReview = {
      ...review,
      status: "rejected",
      rejectionReason: input.rejectionReason,
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      updatedAt: this.now().toISOString(),
    };
    return this.deps.reviewRepo.update(updated);
  }

  async markManuallyPublished(input: {
    candidateId: string;
    manualPublication: ManualPublicationRecord;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    if (review.status !== "approved_for_manual_publish") {
      throw new Error("must_be_approved_before_manual_publication_record");
    }
    assertAllowedTransition(review.status, "manually_published");

    const updated: HumanMarketingReview = {
      ...review,
      status: "manually_published",
      manualPublication: input.manualPublication,
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      manuallyPublishedAt: input.manualPublication.publishedAt ?? this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };
    return this.deps.reviewRepo.update(updated);
  }
}

export async function createHumanMarketingReviewService(
  deps: Partial<HumanMarketingReviewServiceDeps> = {},
): Promise<HumanMarketingReviewService> {
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createHumanMarketingReviewRepository } = await import(
    "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const candidateRepo = deps.candidateRepo ?? (await createDailyMarketingRunRepository());
  const reviewRepo = deps.reviewRepo ?? (await createHumanMarketingReviewRepository());
  return new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: deps.now });
}
