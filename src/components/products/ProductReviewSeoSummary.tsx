/**
 * PR22: 공개 상품 상세용 리뷰 요약 텍스트.
 * 평균 평점, 리뷰 수, 대표 요약 문장을 본문에 노출 (SEO·접근성).
 */
export type ProductReviewSeoSummaryProps = {
  averageRating: number;
  reviewCount: number;
  summaryText?: string;
};

export function ProductReviewSeoSummary({
  averageRating,
  reviewCount,
  summaryText,
}: ProductReviewSeoSummaryProps) {
  if (reviewCount === 0) return null;

  const avg = averageRating.toFixed(1);

  return (
    <p className="text-sm text-[var(--text-secondary)]">
      이 상품은 평균 {avg}점(리뷰 {reviewCount}개)
      {summaryText?.trim()
        ? `으로 ${summaryText.trim()}${summaryText.trim().endsWith(".") ? "" : "."}`
        : "의 실제 여행 후기가 등록되어 있습니다."}
    </p>
  );
}
