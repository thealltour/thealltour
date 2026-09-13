import type { MorningReviewQueueSummary } from "@/lib/marketing/review/morningReview/types";

/** Shape morning queue into AI marketing hub snapshot fields (server-safe). */
export function hubFieldsFromReviewQueue(queue: MorningReviewQueueSummary | null): {
  reviewPendingCount: number | null;
  todayCandidateTitle: string | null;
  todayCandidateId: string | null;
} {
  if (!queue) {
    return { reviewPendingCount: null, todayCandidateTitle: null, todayCandidateId: null };
  }
  return {
    reviewPendingCount: queue.pendingCount,
    todayCandidateTitle: queue.todayCandidate?.title ?? null,
    todayCandidateId: queue.todayCandidate?.candidateId ?? null,
  };
}
