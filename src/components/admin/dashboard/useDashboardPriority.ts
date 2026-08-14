"use client";

import { useMemo } from "react";
import type { ReviewModerationSummaryResponse } from "./useReviewSummary";

export type DashboardPriorityLevel = "high" | "medium" | "low";

export type DashboardPriorityItem = {
  id: string;
  type: string;
  priority: DashboardPriorityLevel;
  count: number;
  label: string;
  href: string;
  /** 동일 티어 내 정렬 (작을수록 먼저) */
  order: number;
};

const MODERATION_FLAGGED_HREF = "/theall_manager_only/reviews/moderation?filter=flagged";

type BuildInput = {
  delayedInquiries: number;
  pendingInquiries: number;
  unreadNotificationCount: number;
  reviewSummary: ReviewModerationSummaryResponse | undefined;
};

export function buildDashboardPriorityItems(input: BuildInput, maxItems = 5): DashboardPriorityItem[] {
  const { delayedInquiries, pendingInquiries, unreadNotificationCount, reviewSummary } = input;
  const flaggedCount = reviewSummary?.flaggedCount ?? 0;
  const highPriorityCount = reviewSummary?.highPriorityCount ?? 0;

  const raw: DashboardPriorityItem[] = [];

  if (delayedInquiries > 0) {
    raw.push({
      id: "delayed",
      type: "delayed",
      priority: "high",
      count: delayedInquiries,
      label: "지연 문의",
      href: "/theall_manager_only/inquiries?status=delayed",
      order: 1,
    });
  }

  if (flaggedCount > 0) {
    raw.push({
      id: "review_flagged",
      type: "review_flagged",
      priority: "high",
      count: flaggedCount,
      label: "신고·플래그 리뷰",
      href: MODERATION_FLAGGED_HREF,
      order: 2,
    });
  }

  if (highPriorityCount > 0 && highPriorityCount !== flaggedCount) {
    raw.push({
      id: "review_high",
      type: "review_high",
      priority: "high",
      count: highPriorityCount,
      label: "우선 검토 리뷰",
      href: MODERATION_FLAGGED_HREF,
      order: 3,
    });
  }

  if (pendingInquiries > 0) {
    raw.push({
      id: "pending",
      type: "pending",
      priority: "medium",
      count: pendingInquiries,
      label: "미처리 문의",
      href: "/theall_manager_only/inquiries?status=pending",
      order: 4,
    });
  }

  if (unreadNotificationCount > 0) {
    raw.push({
      id: "notifications",
      type: "notifications",
      priority: "low",
      count: unreadNotificationCount,
      label: "미읽음 알림",
      href: "/theall_manager_only/notifications?filter=unread",
      order: 5,
    });
  }

  const tierRank: Record<DashboardPriorityLevel, number> = { high: 0, medium: 1, low: 2 };

  const sorted = [...raw].sort((a, b) => {
    const tr = tierRank[a.priority] - tierRank[b.priority];
    if (tr !== 0) return tr;
    if (a.order !== b.order) return a.order - b.order;
    return b.count - a.count;
  });

  return sorted.slice(0, maxItems);
}

export function useDashboardPriority(input: BuildInput, maxItems = 5): DashboardPriorityItem[] {
  return useMemo(() => buildDashboardPriorityItems(input, maxItems), [
    input.delayedInquiries,
    input.pendingInquiries,
    input.unreadNotificationCount,
    input.reviewSummary,
    maxItems,
  ]);
}
