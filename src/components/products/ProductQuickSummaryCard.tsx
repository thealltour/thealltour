"use client";

import { InfoItem } from "@/components/products/detail/InfoItem";

/**
 * PR9/PR10: 갤러리(히어로) 아래 여행 핵심 요약 카드.
 * 정보 위계: 일정 → 날짜 → 테마 → 상품 특징. InfoItem 행으로 스캔 UX 통일.
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
  const dateLine = departureLabel || dateRangeLabel;
  const visibleHighlights = highlightItems.slice(0, MAX_HIGHLIGHTS);
  const hasBottom = visibleHighlights.length > 0;
  const hasInfoRows = Boolean(durationLabel || themeLabel || dateLine);

  if (!hasInfoRows && !hasBottom) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4"
      aria-label="여행 핵심 요약"
    >
      {hasInfoRows && (
        <div className="space-y-2.5">
          {durationLabel ? <InfoItem icon="calendar" label="여행 기간" value={durationLabel} /> : null}
          {themeLabel ? <InfoItem icon="sparkles" label="테마" value={themeLabel} /> : null}
          {dateLine ? <InfoItem icon="calendar" label="출발·일정" value={dateLine} /> : null}
        </div>
      )}

      {hasBottom && (
        <div className={`summary-highlights flex flex-wrap gap-2 ${hasInfoRows ? "mt-3 border-t border-slate-100 pt-3" : ""}`}>
          {visibleHighlights.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs leading-snug text-gray-700"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
