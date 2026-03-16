"use client";

import Link from "next/link";

export type ProductReviewSectionProps = {
  /** 평균 평점 (1~5). 있으면 리뷰 있음 UI */
  rating?: number;
  /** 후기 개수. 0이면 리뷰 없음 UI */
  reviewCount?: number;
  /** 최근 예약/상담 건수. 리뷰 없을 때 신뢰도 보완용 */
  bookingCount?: number;
  /** 예약 상담하기 CTA 링크 (예: /quote?productId=...) */
  consultHref?: string;
};

/**
 * PR27: 리뷰 영역 신뢰도 카드.
 * 리뷰가 있으면 평점+후기 수, 없으면 최근 예약 수 + 상담 CTA를 표시합니다.
 */
export function ProductReviewSection({
  rating,
  reviewCount = 0,
  bookingCount,
  consultHref,
}: ProductReviewSectionProps) {
  const hasReviews = typeof reviewCount === "number" && reviewCount > 0;
  const displayRating = typeof rating === "number" && rating >= 0 && rating <= 5 ? rating : null;
  const displayBooking = typeof bookingCount === "number" && bookingCount >= 0 ? bookingCount : null;

  return (
    <section
      id="reviews"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="여행 후기"
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-800">여행 후기</h2>

      {hasReviews && displayRating != null ? (
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
            <span aria-hidden>⭐</span>
            {displayRating.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600">후기 {reviewCount}개</p>
        </div>
      ) : (
        <>
          {displayBooking != null && (
            <p className="text-base font-semibold text-slate-900">최근 예약 {displayBooking}건</p>
          )}
          <p className="mt-1 text-sm text-gray-600">아직 등록된 후기가 없습니다</p>
          {consultHref && (
            <div className="mt-4">
              <Link
                href={consultHref}
                className="inline-flex rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                예약 상담하기
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
