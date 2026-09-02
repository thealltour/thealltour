import { createHash } from "node:crypto";

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { HumanReviewIneligibilityReason } from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";
import { evaluateHumanReviewEligibility } from "@/lib/marketing/review/bootstrap/eligibility";
import { createInitialHumanReview } from "@/lib/marketing/review/dto";
import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

export type HumanReviewBootstrapResult =
  | { outcome: "created"; review: HumanMarketingReview }
  | { outcome: "reused"; review: HumanMarketingReview }
  | { outcome: "skipped"; reason: HumanReviewIneligibilityReason; candidateId: string }
  | { outcome: "failed"; error: string; candidateId: string };

export type BootstrapHumanReviewDeps = {
  reviewRepo: HumanMarketingReviewRepository;
  now?: () => Date;
  includeVerification?: boolean;
};

export function buildDeterministicReviewId(candidateId: string): string {
  const digest = createHash("sha256").update(candidateId).digest("hex").slice(0, 16);
  return `hmr_${digest}`;
}

export async function bootstrapHumanReviewForCandidate(
  candidate: CompletedMarketingCandidate,
  deps: BootstrapHumanReviewDeps,
): Promise<HumanReviewBootstrapResult> {
  const now = deps.now?.() ?? new Date();

  const eligibility = evaluateHumanReviewEligibility(candidate, {
    includeVerification: deps.includeVerification,
  });
  if (!eligibility.eligible) {
    return {
      outcome: "skipped",
      reason: eligibility.reason,
      candidateId: candidate.candidateId,
    };
  }

  const existing = await deps.reviewRepo.findByCandidateId(candidate.candidateId);
  if (existing) {
    return { outcome: "reused", review: existing };
  }

  const review = createInitialHumanReview(candidate, null, now, buildDeterministicReviewId(candidate.candidateId));

  try {
    const saved = await deps.reviewRepo.save(review);
    if (saved.reviewId !== review.reviewId || saved.status !== review.status) {
      return { outcome: "reused", review: saved };
    }
    return { outcome: "created", review: saved };
  } catch (error) {
    const raced = await deps.reviewRepo.findByCandidateId(candidate.candidateId);
    if (raced) {
      return { outcome: "reused", review: raced };
    }
    return {
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error),
      candidateId: candidate.candidateId,
    };
  }
}

export type BootstrapMissingHumanReviewsResult = {
  scanned: number;
  created: number;
  reused: number;
  skipped: number;
  failed: number;
  results: HumanReviewBootstrapResult[];
};

export async function bootstrapMissingHumanMarketingReviews(input: {
  candidateRepo: DailyMarketingRunRepository;
  reviewRepo: HumanMarketingReviewRepository;
  businessDateKst?: string;
  candidateId?: string;
  includeVerification?: boolean;
  now?: () => Date;
}): Promise<BootstrapMissingHumanReviewsResult> {
  const deps: BootstrapHumanReviewDeps = {
    reviewRepo: input.reviewRepo,
    now: input.now,
    includeVerification: input.includeVerification,
  };

  let candidates: CompletedMarketingCandidate[];
  if (input.candidateId) {
    const candidate = await input.candidateRepo.findCandidateByCandidateId(input.candidateId);
    candidates = candidate ? [candidate] : [];
  } else {
    candidates = await input.candidateRepo.listCandidates({
      businessDateKst: input.businessDateKst,
      limit: 200,
    });
  }

  const results: HumanReviewBootstrapResult[] = [];
  let created = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const result = await bootstrapHumanReviewForCandidate(candidate, deps);
    results.push(result);
    switch (result.outcome) {
      case "created":
        created += 1;
        break;
      case "reused":
        reused += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "failed":
        failed += 1;
        break;
    }
  }

  return { scanned: candidates.length, created, reused, skipped, failed, results };
}
