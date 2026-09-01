import type { HumanMarketingReview } from "@/lib/marketing/review/types";

export type HumanMarketingReviewRepository = {
  findByCandidateId(candidateId: string): Promise<HumanMarketingReview | null>;
  findByReviewId(reviewId: string): Promise<HumanMarketingReview | null>;
  listReviews(options?: { limit?: number }): Promise<HumanMarketingReview[]>;
  save(review: HumanMarketingReview): Promise<HumanMarketingReview>;
  update(review: HumanMarketingReview): Promise<HumanMarketingReview>;
};

export function createInMemoryHumanMarketingReviewRepository(): HumanMarketingReviewRepository {
  const byCandidate = new Map<string, HumanMarketingReview>();
  const byReview = new Map<string, HumanMarketingReview>();

  return {
    async findByCandidateId(candidateId) {
      return byCandidate.get(candidateId) ?? null;
    },
    async findByReviewId(reviewId) {
      return byReview.get(reviewId) ?? null;
    },
    async listReviews(options = {}) {
      const limit = options.limit ?? 100;
      return [...byCandidate.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },
    async save(review) {
      const existing = byCandidate.get(review.candidateId);
      if (existing) return existing;
      byCandidate.set(review.candidateId, review);
      byReview.set(review.reviewId, review);
      return review;
    },
    async update(review) {
      byCandidate.set(review.candidateId, review);
      byReview.set(review.reviewId, review);
      return review;
    },
  };
}

let defaultRepo: HumanMarketingReviewRepository | null = null;

export function getDefaultHumanMarketingReviewRepository(): HumanMarketingReviewRepository {
  if (!defaultRepo) defaultRepo = createInMemoryHumanMarketingReviewRepository();
  return defaultRepo;
}

export function resetDefaultHumanMarketingReviewRepository(): void {
  defaultRepo = null;
}

export async function createHumanMarketingReviewRepository(deps: {
  backend?: "memory" | "supabase";
} = {}): Promise<HumanMarketingReviewRepository> {
  if (deps.backend === "memory") {
    return createInMemoryHumanMarketingReviewRepository();
  }
  const { SupabaseHumanMarketingReviewRepository } = await import(
    "@/lib/marketing/review/repository/supabaseHumanMarketingReviewRepository"
  );
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return new SupabaseHumanMarketingReviewRepository(supabaseAdmin);
}
