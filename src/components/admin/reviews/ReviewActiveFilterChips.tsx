"use client";

import type { ReviewSearchFiltersState } from "@/types/reviewSearch";
import { DEFAULT_REVIEW_FILTERS } from "@/lib/reviewSearchConstants";

type ReviewActiveFilterChipsProps = {
  filters: ReviewSearchFiltersState;
  onRemove: (key: keyof ReviewSearchFiltersState) => void;
  onResetAll: () => void;
};

function isActive(filters: ReviewSearchFiltersState): boolean {
  if (filters.query.trim()) return true;
  if (filters.productId.trim()) return true;
  if (filters.rating !== "all") return true;
  if (filters.verified !== "all") return true;
  if (filters.hasImages !== "all") return true;
  if (filters.helpfulMin != null && filters.helpfulMin > 0) return true;
  if (filters.dateFrom || filters.dateTo) return true;
  if (filters.recommendationBand !== "all") return true;
  return false;
}

export function ReviewActiveFilterChips({ filters, onRemove, onResetAll }: ReviewActiveFilterChipsProps) {
  if (!isActive(filters)) return null;

  const chips: { key: keyof ReviewSearchFiltersState; label: string }[] = [];
  if (filters.query.trim()) chips.push({ key: "query", label: `검색: ${filters.query.slice(0, 20)}…` });
  if (filters.productId.trim()) chips.push({ key: "productId", label: `상품: ${filters.productId}` });
  if (filters.rating !== "all") chips.push({ key: "rating", label: `평점 ${filters.rating}` });
  if (filters.verified !== "all")
    chips.push({ key: "verified", label: filters.verified === "verified" ? "인증만" : "비인증만" });
  if (filters.hasImages !== "all")
    chips.push({ key: "hasImages", label: filters.hasImages === "with_images" ? "이미지 있음" : "이미지 없음" });
  if (filters.helpfulMin != null && filters.helpfulMin > 0)
    chips.push({ key: "helpfulMin", label: `도움됨 ≥${filters.helpfulMin}` });
  if (filters.dateFrom) chips.push({ key: "dateFrom", label: `From ${filters.dateFrom}` });
  if (filters.dateTo) chips.push({ key: "dateTo", label: `To ${filters.dateTo}` });
  if (filters.recommendationBand !== "all")
    chips.push({ key: "recommendationBand", label: `추천 ${filters.recommendationBand}` });

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ key, label }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs"
        >
          {label}
          <button
            type="button"
            onClick={() => onRemove(key)}
            className="rounded-full p-0.5 hover:bg-[var(--border)]"
            aria-label={`${label} 제거`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="text-xs text-[var(--primary)] hover:underline"
        style={{ marginLeft: "0.25rem" }}
      >
        전체 초기화
      </button>
    </div>
  );
}
