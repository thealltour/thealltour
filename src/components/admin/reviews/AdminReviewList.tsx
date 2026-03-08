"use client";

import type { AdminReviewListItem } from "@/types/reviewSearch";
import { AdminReviewListItemCard } from "./AdminReviewListItemCard";

type AdminReviewListProps = {
  reviews: AdminReviewListItem[];
};

export function AdminReviewList({ reviews }: AdminReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          검색/필터 조건에 맞는 리뷰가 없습니다.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          필터를 초기화하고 다시 확인해 주세요.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id}>
          <AdminReviewListItemCard review={review} />
        </li>
      ))}
    </ul>
  );
}
