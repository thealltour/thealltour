"use client";

import type { ReviewSearchFiltersState } from "@/types/reviewSearch";
import { DEFAULT_REVIEW_FILTERS } from "@/lib/reviewSearchConstants";

type ReviewFilterPanelProps = {
  filters: ReviewSearchFiltersState;
  onChange: (filters: ReviewSearchFiltersState) => void;
};

export function ReviewFilterPanel({ filters, onChange }: ReviewFilterPanelProps) {
  const update = (patch: Partial<ReviewSearchFiltersState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Product ID</label>
        <input
          type="text"
          placeholder="상품 ID"
          value={filters.productId}
          onChange={(e) => update({ productId: e.target.value })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">평점</label>
        <select
          value={filters.rating === "all" ? "all" : String(filters.rating)}
          onChange={(e) =>
            update({
              rating: e.target.value === "all" ? "all" : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
            })
          }
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        >
          <option value="all">전체</option>
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">인증</label>
        <select
          value={filters.verified}
          onChange={(e) => update({ verified: e.target.value as ReviewSearchFiltersState["verified"] })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        >
          <option value="all">전체</option>
          <option value="verified">인증만</option>
          <option value="unverified">비인증만</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">이미지</label>
        <select
          value={filters.hasImages}
          onChange={(e) => update({ hasImages: e.target.value as ReviewSearchFiltersState["hasImages"] })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        >
          <option value="all">전체</option>
          <option value="with_images">이미지 있음</option>
          <option value="without_images">이미지 없음</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">도움됨 최소</label>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={filters.helpfulMin ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            update({ helpfulMin: v === "" ? null : Math.max(0, parseInt(v, 10) || 0) });
          }}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">기간 From</label>
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => update({ dateFrom: e.target.value || null })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">기간 To</label>
        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => update({ dateTo: e.target.value || null })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">추천 점수</label>
        <select
          value={filters.recommendationBand}
          onChange={(e) =>
            update({
              recommendationBand: e.target.value as ReviewSearchFiltersState["recommendationBand"],
            })
          }
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
        >
          <option value="all">전체</option>
          <option value="high">높음 (80+)</option>
          <option value="medium">중간 (50~79)</option>
          <option value="low">낮음 (&lt;50)</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={() => onChange(DEFAULT_REVIEW_FILTERS)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          필터 초기화
        </button>
      </div>
    </div>
  );
}
