"use client";

import { useQuery } from "@tanstack/react-query";

export type ReviewModerationSummaryResponse = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
};

export function useReviewSummary() {
  return useQuery<ReviewModerationSummaryResponse>({
    queryKey: ["admin-review-moderation-summary"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reviews/summary", { cache: "no-store" });
      const json = (await response.json()) as ReviewModerationSummaryResponse & { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "리뷰 요약을 불러오지 못했습니다.");
      }
      return {
        pendingCount: json.pendingCount ?? 0,
        highPriorityCount: json.highPriorityCount ?? 0,
        flaggedCount: json.flaggedCount ?? 0,
        hiddenCount: json.hiddenCount ?? 0,
      };
    },
  });
}
