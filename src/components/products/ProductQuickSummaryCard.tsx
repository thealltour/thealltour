"use client";

import { Calendar, Sparkles } from "lucide-react";

/**
 * PR9/PR10: 갤러리(히어로) 아래 여행 핵심 요약 카드.
 * 정보 위계: 일정 → 날짜 → 테마 → 상품 특징. 정돈된 정보 카드 톤 유지.
 */

export type ProductQuickSummaryCardProps = {
  /** 일정 (예: 3박 5일) */
  durationLabel?: string;
  /** 테마 (예: 휴양 / 힐링), 중복 없이 1회 */
  themeLabel?: string;
  /** 출발일만 있을 때 (예: 2026.04.15(수) 출발) */
  departureLabel?: string;
  /** 기간이 있을 때 (예: 2026.04.15(수) ~ 04.19(일)) */
  dateRangeLabel?: string;
  /** 카드 하단 핵심 특징 (최대 4개) */
  highlightItems?: string[];
};

const MAX_HIGHLIGHTS = 4;

export function ProductQuickSummaryCard({
  durationLabel = "",
  themeLabel = "",
  departureLabel = "",
  dateRangeLabel = "",
  highlightItems = [],
}: ProductQuickSummaryCardProps) {
  const hasTop = Boolean(durationLabel || themeLabel);
  const hasMiddle = Boolean(departureLabel || dateRangeLabel);
  const visibleHighlights = highlightItems.slice(0, MAX_HIGHLIGHTS);
  const hasBottom = visibleHighlights.length > 0;

  if (!hasTop && !hasMiddle && !hasBottom) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      aria-label="여행 핵심 요약"
    >
      {/* 상단 핵심: 일정 → 테마 (가장 먼저 읽히도록) */}
      {hasTop && (
        <div className="summary-top flex flex-wrap items-center gap-x-4 gap-y-1">
          {durationLabel && (
            <div className="summary-duration flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <span className="text-lg font-semibold text-slate-800">{durationLabel}</span>
            </div>
          )}
          {themeLabel && (
            <div className="summary-theme flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <span className="text-sm text-gray-600">{themeLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* 중단 보조: 날짜 또는 출발일 */}
      {hasMiddle && (
        <div className="summary-date mt-2 text-sm text-gray-500">
          {departureLabel || dateRangeLabel}
        </div>
      )}

      {/* 하단: 상품 특징 chips (가독성·일관성) */}
      {hasBottom && (
        <div className="summary-highlights mt-3 flex flex-wrap gap-2">
          {visibleHighlights.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
