"use client";

export type ProductTrustSummaryProps = {
  /** 평균 평점 (1~5) */
  rating?: number;
  /** 후기 개수 */
  reviewCount?: number;
  /** 최근 예약/상담 건수 */
  bookingCount?: number;
  /** 예약 가능 상태 라벨 (예: 예약 가능, 상담 가능) */
  statusLabel?: string;
};

/**
 * PR33: Hero 근처 신뢰도 정보 바.
 * 평점 / 후기 수 / 예약 수 / 상태 중 표시 가능한 항목만 간결하게 노출합니다.
 * 모바일 상세 상단에서 스캔 가능한 요약형만 보여주며, 상세 리뷰는 기존 리뷰 섹션에서 유지합니다.
 */
export function ProductTrustSummary({
  rating,
  reviewCount,
  bookingCount,
  statusLabel,
}: ProductTrustSummaryProps) {
  const hasRating = typeof rating === "number" && rating >= 0 && rating <= 5;
  const hasReviews = typeof reviewCount === "number" && reviewCount > 0;
  const hasBooking = typeof bookingCount === "number" && bookingCount >= 0;
  const hasStatus = typeof statusLabel === "string" && statusLabel.trim().length > 0;

  const items: Array<{ key: string; children: React.ReactNode }> = [];

  if (hasRating) {
    items.push({
      key: "rating",
      children: (
        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
          <span className="text-amber-500" aria-hidden>⭐</span>
          {rating!.toFixed(1)}
        </span>
      ),
    });
  }
  if (hasReviews) {
    items.push({
      key: "reviews",
      children: (
        <span className="text-slate-700">
          후기 <span className="font-semibold text-slate-800">{reviewCount}</span>개
        </span>
      ),
    });
  }
  if (hasBooking) {
    items.push({
      key: "booking",
      children: (
        <span className="text-slate-700">
          최근 예약 <span className="font-semibold text-slate-800">{bookingCount}</span>건
        </span>
      ),
    });
  }
  if (hasStatus && items.length < 3) {
    items.push({
      key: "status",
      children: <span className="font-medium text-slate-700">{statusLabel}</span>,
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
      aria-label="상품 신뢰도 요약"
    >
      {items.map((item, index) => (
        <span key={item.key}>
          {index > 0 && <span className="mr-1 text-slate-300" aria-hidden>·</span>}
          {item.children}
        </span>
      ))}
    </div>
  );
}
