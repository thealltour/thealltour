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
import { assertShortformReadyForManualPublish } from "@/lib/marketing/review/assertShortformReadyForManualPublish";
import type {
  HumanMarketingReview,
  HumanReviewDetail,
  HumanReviewDraft,
  HumanReviewQueueFilter,
  HumanReviewQueueItem,
  ManualPublicationRecord,
} from "@/lib/marketing/review/types";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import {
  emptyChannelReviewEntry,
  type ChannelReviewStatus,
  type ReviewablePublishableChannel,
} from "@/lib/marketing/review/channelReviews";
import { persistChannelHumanEditToPackage } from "@/lib/marketing/review/persistChannelHumanEdit";

export type HumanMarketingReviewServiceDeps = {
  candidateRepo: DailyMarketingRunRepository;
  reviewRepo: HumanMarketingReviewRepository;
  now?: () => Date;
  /** Optional injections for CG-3 shortform approval gate (tests). */
  shortformCatalog?: MarketingMediaSourceCatalogRepository;
  shortformJobRepository?: ShortformVideoRenderJobRepository;
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
    canMarkManuallyPublished:
      humanStatus === "approved_for_manual_publish" || humanStatus === "manually_published",
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
    await assertShortformReadyForManualPublish({
      candidateId: input.candidateId,
      candidate,
      catalog: this.deps.shortformCatalog,
      jobRepository: this.deps.shortformJobRepository,
      repository: this.deps.candidateRepo,
    });

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

  /**
   * CG-4C — channel-scoped draft save. Does not overwrite other channels.
   * Threads also updates compatibility currentDraft.
   */
  async updateChannelReviewDraft(input: {
    candidateId: string;
    channel: ReviewablePublishableChannel;
    title?: string | null;
    body: string;
    notes?: string | null;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");
    if (isCandidateDiagnosticsOnly(candidate.status)) {
      throw new Error("diagnostics_only_candidate");
    }
    if (isCandidateBlocked(candidate.status) && candidate.governanceDecision?.decision === "BLOCK") {
      // Still allow edits while blocked, but channel cannot be approved later.
    }

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    if (review.status === "rejected" || review.status === "manually_published") {
      throw new Error("review_not_editable");
    }

    const nextStatus = review.status === "pending" ? "editing" : review.status;
    assertAllowedTransition(review.status, nextStatus);

    const existingEntry =
      review.channelReviews?.[input.channel] ??
      emptyChannelReviewEntry(input.channel, { title: input.title ?? null, body: input.body });

    const nowIso = this.now().toISOString();
    // MQ-5: deterministic re-eval on human save (cheap; no LLM).
    const { evaluateMarketingValue } = await import("@/lib/marketing/value/evaluateMarketingValue");
    const { toMarketingValueCompact } = await import("@/lib/marketing/value/contracts");
    const marketingValue = toMarketingValueCompact(
      evaluateMarketingValue({
        channel: input.channel === "shortform" ? "shortform" : input.channel,
        body: input.body,
        title: input.title ?? null,
        content: {
          status: "human_edited",
          publishableSuccess: true,
          provenance: { composer: "human", evidenceRefIds: [], commercialIntent: null },
          validation: { ok: true, issues: [] },
          body: input.body,
          title: input.title ?? null,
        } as never,
        proposition: candidate.contentPlan?.proposition ?? null,
        now: this.now(),
      }),
    );

    const entry = {
      ...existingEntry,
      humanDraft: {
        title: input.title ?? null,
        body: input.body,
      },
      status:
        existingEntry.status === "approved" || existingEntry.status === "skipped"
          ? ("needs_review" as const)
          : existingEntry.status === "draft"
            ? ("needs_review" as const)
            : existingEntry.status,
      lastEditedAt: nowIso,
      notes: input.notes ?? existingEntry.notes,
      marketingValue,
    };

    const channelReviews = {
      ...(review.channelReviews ?? {}),
      [input.channel]: entry,
    };

    let currentDraft = review.currentDraft;
    let humanEditedAfterGovernance = review.humanEditedAfterGovernance;
    if (input.channel === "threads") {
      currentDraft = {
        title: input.title ?? null,
        body: input.body,
        channel: "threads",
      };
      humanEditedAfterGovernance = computeGovernanceStale(
        review.governanceReviewedDraftBody,
        input.body,
      );
    }

    const updated: HumanMarketingReview = {
      ...review,
      status: nextStatus,
      currentDraft,
      channelReviews,
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      humanEditedAfterGovernance,
      updatedAt: nowIso,
    };
    const saved = await this.deps.reviewRepo.update(updated);

    // Best-effort package sync — never fails the review save.
    persistChannelHumanEditToPackage({
      candidate,
      channel: input.channel,
      title: input.title ?? null,
      body: input.body,
      now: this.now(),
    });

    return saved;
  }

  /**
   * CG-4C — approve/skip one channel without touching others.
   * Candidate BLOCK governance prevents channel approval.
   * Approving ≥1 channel may lift review to approved_for_manual_publish.
   */
  async setChannelReviewStatus(input: {
    candidateId: string;
    channel: ReviewablePublishableChannel;
    status: Extract<ChannelReviewStatus, "approved" | "skipped" | "needs_review">;
    notes?: string | null;
    humanNotes?: string | null;
    reviewedBy: string | null;
  }): Promise<HumanMarketingReview> {
    const candidate = await this.deps.candidateRepo.findCandidateByCandidateId(input.candidateId);
    if (!candidate) throw new Error("candidate_not_found");
    if (isCandidateDiagnosticsOnly(candidate.status)) {
      throw new Error("diagnostics_only_candidate");
    }

    if (input.status === "approved") {
      if (candidate.status === "blocked" || candidate.governanceDecision?.decision === "BLOCK") {
        throw new Error("governance_block_prevents_channel_approval");
      }
      // MQ-4 — fallback / generation_failed / validation_failed cannot be approved.
      const { approvalBlockedReasonForChannel } = await import(
        "@/lib/marketing/publishable/publishableSuccess"
      );
      const { isMarketingValueApprovable } = await import("@/lib/marketing/value/contracts");
      const { resolveMarketingAssetRoot } = await import("@/lib/marketing/assets/config");
      const { resolvePackageDirectory } = await import("@/lib/marketing/assets/paths");
      const { ensurePublishableContentSync } = await import(
        "@/lib/marketing/publishable/ensurePublishableContentSync"
      );
      try {
        const assetRoot = resolveMarketingAssetRoot({});
        const packageRoot = resolvePackageDirectory({
          assetRoot,
          businessDateKst: candidate.businessDateKst,
          candidateId: input.candidateId,
        });
        const bundle = ensurePublishableContentSync({
          candidate,
          packageRoot,
          allowDeterministicGeneration: false,
        });
        const slot =
          input.channel === "threads"
            ? bundle.threads
            : input.channel === "shortform"
              ? bundle.shortform
              : input.channel === "naver_blog"
                ? bundle.naver_blog
                : input.channel === "naver_band"
                  ? bundle.naver_band
                  : bundle.kakao_channel;
        const reviewForGate = await this.loadMutableReview(input.candidateId, input.reviewedBy);
        const channelEntry = reviewForGate.channelReviews?.[input.channel];
        const humanOwns = Boolean(channelEntry?.humanDraft?.body?.trim());
        if (!humanOwns) {
          if (slot) {
            const blocked = approvalBlockedReasonForChannel(slot);
            if (blocked) {
              throw new Error(blocked);
            }
          } else if (
            channelEntry?.validationWarnings?.some(
              (w) =>
                /degraded:fallback|generation_failed|validation_failed|needs_regeneration/i.test(w),
            )
          ) {
            throw new Error("regeneration_required:fallback_generated_not_approvable");
          }
        }
        const assessment = slot?.marketingValue ?? channelEntry?.marketingValue ?? null;
        const override =
          /marketing_value_override|value_override/i.test(channelEntry?.notes ?? "") ||
          /marketing_value_override|value_override/i.test(input.notes ?? "");
        if (assessment) {
          const ok = isMarketingValueApprovable(assessment as never, {
            allowNeedsImprovementOverride: override,
          });
          if (!ok) {
            if (assessment.stale) {
              throw new Error("regeneration_required:marketing_value_stale");
            }
            if (assessment.verdict === "reject" || assessment.hardFail) {
              throw new Error("regeneration_required:marketing_value_reject");
            }
            if (assessment.verdict === "needs_improvement") {
              throw new Error(
                "regeneration_required:marketing_value_needs_improvement — edit content or set notes=marketing_value_override",
              );
            }
            throw new Error("regeneration_required:marketing_value");
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("regeneration_required")) {
          throw error;
        }
        // If package missing, still allow existing review tests without marketingValue.
      }
      if (input.channel === "shortform") {
        await assertShortformReadyForManualPublish({
          candidateId: input.candidateId,
          candidate,
          catalog: this.deps.shortformCatalog,
          jobRepository: this.deps.shortformJobRepository,
          repository: this.deps.candidateRepo,
        });
      }
    }

    const review = await this.loadMutableReview(input.candidateId, input.reviewedBy);
    if (review.status === "rejected") {
      throw new Error("review_rejected");
    }

    const existing =
      review.channelReviews?.[input.channel] ??
      emptyChannelReviewEntry(input.channel, {
        title: review.currentDraft.title,
        body: review.currentDraft.body,
      });

    const nowIso = this.now().toISOString();
    const entry = {
      ...existing,
      status: input.status,
      notes: input.notes ?? existing.notes,
      approvedAt: input.status === "approved" ? nowIso : existing.approvedAt,
      skippedAt: input.status === "skipped" ? nowIso : existing.skippedAt,
    };

    const channelReviews = {
      ...(review.channelReviews ?? {}),
      [input.channel]: entry,
    };

    const anyApproved = Object.values(channelReviews).some((c) => c?.status === "approved");
    let nextReviewStatus = review.status;
    let approvedAt = review.approvedAt;
    if (
      anyApproved &&
      (review.status === "pending" || review.status === "editing" || review.status === "deferred")
    ) {
      assertAllowedTransition(review.status, "approved_for_manual_publish");
      nextReviewStatus = "approved_for_manual_publish";
      approvedAt = nowIso;
    }

    const updated: HumanMarketingReview = {
      ...review,
      status: nextReviewStatus,
      channelReviews,
      humanNotes: input.humanNotes ?? review.humanNotes,
      reviewedBy: input.reviewedBy ?? review.reviewedBy,
      approvedAt,
      updatedAt: nowIso,
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
    // Idempotent re-record: already manually_published may update metadata only.
    if (review.status === "manually_published") {
      const updated: HumanMarketingReview = {
        ...review,
        manualPublication: {
          ...review.manualPublication,
          ...input.manualPublication,
        },
        humanNotes: input.humanNotes ?? review.humanNotes,
        reviewedBy: input.reviewedBy ?? review.reviewedBy,
        manuallyPublishedAt:
          input.manualPublication.publishedAt ??
          review.manuallyPublishedAt ??
          this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      };
      return this.deps.reviewRepo.update(updated);
    }
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
  return new HumanMarketingReviewService({
    candidateRepo,
    reviewRepo,
    now: deps.now,
    shortformCatalog: deps.shortformCatalog,
    shortformJobRepository: deps.shortformJobRepository,
  });
}
