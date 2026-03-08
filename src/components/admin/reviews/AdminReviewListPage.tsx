"use client";

import { useMemo, useState } from "react";
import type { AdminReviewListItem } from "@/types/reviewSearch";
import {
  filterReviews,
  sortReviews,
  attachRecommendationScores,
} from "@/lib/reviewSearchFilters";
import { DEFAULT_REVIEW_FILTERS } from "@/lib/reviewSearchConstants";
import type { ReviewSearchFiltersState, ReviewSortOption } from "@/types/reviewSearch";
import { ReviewSearchBar } from "./ReviewSearchBar";
import { ReviewFilterPanel } from "./ReviewFilterPanel";
import { ReviewSortSelect } from "./ReviewSortSelect";
import { ReviewActiveFilterChips } from "./ReviewActiveFilterChips";
import { AdminReviewList } from "./AdminReviewList";

type AdminReviewListPageProps = {
  reviews: AdminReviewListItem[];
};

export function AdminReviewListPage({ reviews: initialReviews }: AdminReviewListPageProps) {
  const [filters, setFilters] = useState<ReviewSearchFiltersState>(DEFAULT_REVIEW_FILTERS);

  const reviewsWithScore = useMemo(
    () => attachRecommendationScores(initialReviews),
    [initialReviews],
  );

  const filtered = useMemo(
    () => filterReviews(reviewsWithScore, filters),
    [reviewsWithScore, filters],
  );

  const sorted = useMemo(() => sortReviews(filtered, filters.sortBy), [filtered, filters.sortBy]);

  const handleRemoveFilter = (key: keyof ReviewSearchFiltersState) => {
    setFilters((prev) => ({ ...prev, [key]: DEFAULT_REVIEW_FILTERS[key] }));
  };

  if (initialReviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">등록된 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          전체 <strong className="text-[var(--text-primary)]">{initialReviews.length}</strong>건
          {sorted.length !== initialReviews.length && (
            <>
              {" "}
              · 검색/필터 결과 <strong className="text-[var(--text-primary)]">{sorted.length}</strong>건
            </>
          )}
        </p>
        <ReviewSortSelect
          value={filters.sortBy}
          onChange={(sortBy) => setFilters((prev) => ({ ...prev, sortBy }))}
        />
      </div>

      <ReviewSearchBar
        value={filters.query}
        onChange={(query) => setFilters((prev) => ({ ...prev, query }))}
      />

      <ReviewFilterPanel filters={filters} onChange={setFilters} />

      <ReviewActiveFilterChips
        filters={filters}
        onRemove={handleRemoveFilter}
        onResetAll={() => setFilters(DEFAULT_REVIEW_FILTERS)}
      />

      <AdminReviewList reviews={sorted} />
    </div>
  );
}
