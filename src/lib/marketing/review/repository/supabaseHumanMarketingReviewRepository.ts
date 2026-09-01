import "server-only";

import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

type DbClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert: (row: unknown, options?: { onConflict?: string }) => unknown;
  };
};

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected single row");
  }
  return data as Record<string, unknown>;
}

function mapReview(row: Record<string, unknown>): HumanMarketingReview {
  return row.payload as HumanMarketingReview;
}

export class SupabaseHumanMarketingReviewRepository implements HumanMarketingReviewRepository {
  constructor(private readonly client: DbClient) {}

  async findByCandidateId(candidateId: string): Promise<HumanMarketingReview | null> {
    const query = this.client.from("human_marketing_reviews").select("*") as {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await query.eq("candidate_id", candidateId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapReview(asRow(data)) : null;
  }

  async findByReviewId(reviewId: string): Promise<HumanMarketingReview | null> {
    const query = this.client.from("human_marketing_reviews").select("*") as {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await query.eq("review_id", reviewId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapReview(asRow(data)) : null;
  }

  async listReviews(options: { limit?: number } = {}): Promise<HumanMarketingReview[]> {
    const limit = options.limit ?? 100;
    const query = this.client.from("human_marketing_reviews").select("*") as {
      order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapReview(asRow(row)));
  }

  async save(review: HumanMarketingReview): Promise<HumanMarketingReview> {
    const existing = await this.findByCandidateId(review.candidateId);
    if (existing) return existing;

    const row = {
      review_id: review.reviewId,
      candidate_id: review.candidateId,
      run_id: review.runId,
      status: review.status,
      payload: review,
      original_draft: review.originalDraft,
      current_draft: review.currentDraft,
      human_notes: review.humanNotes,
      rejection_reason: review.rejectionReason,
      deferred_until: review.deferredUntil,
      manual_publication: review.manualPublication,
      reviewed_by: review.reviewedBy,
      governance_reviewed_draft_body: review.governanceReviewedDraftBody,
      human_edited_after_governance: review.humanEditedAfterGovernance,
      approved_at: review.approvedAt,
      manually_published_at: review.manuallyPublishedAt,
    };

    const upsert = this.client.from("human_marketing_reviews").upsert(row, { onConflict: "candidate_id" }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) throw new Error(error.message);
    return mapReview(asRow(data));
  }

  async update(review: HumanMarketingReview): Promise<HumanMarketingReview> {
    const row = {
      review_id: review.reviewId,
      candidate_id: review.candidateId,
      run_id: review.runId,
      status: review.status,
      payload: review,
      original_draft: review.originalDraft,
      current_draft: review.currentDraft,
      human_notes: review.humanNotes,
      rejection_reason: review.rejectionReason,
      deferred_until: review.deferredUntil,
      manual_publication: review.manualPublication,
      reviewed_by: review.reviewedBy,
      governance_reviewed_draft_body: review.governanceReviewedDraftBody,
      human_edited_after_governance: review.humanEditedAfterGovernance,
      approved_at: review.approvedAt,
      manually_published_at: review.manuallyPublishedAt,
      updated_at: review.updatedAt,
    };

    const upsert = this.client.from("human_marketing_reviews").upsert(row, { onConflict: "candidate_id" }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) throw new Error(error.message);
    return mapReview(asRow(data));
  }
}
