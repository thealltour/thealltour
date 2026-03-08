/**
 * PR14: 상품 상세 리뷰 요약 카드.
 * - status=ready, review_count>=2, summary_text 있을 때만 표시.
 */
import { getProductReviewSummary } from "@/lib/reviewSummaries";

export type ProductReviewSummaryCardProps = {
  productId: string;
};

export async function ProductReviewSummaryCard({ productId }: ProductReviewSummaryCardProps) {
  const summary = await getProductReviewSummary(productId);

  if (
    !summary ||
    summary.status !== "ready" ||
    summary.review_count < 2 ||
    !summary.summary_text?.trim()
  ) {
    return null;
  }

  const avg =
    summary.average_rating != null ? summary.average_rating.toFixed(1) : null;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">리뷰 한눈에 보기</h3>
      <p className="mt-1 text-sm text-slate-500">
        {avg != null && `평균 평점 ${avg}점`}
        {avg != null && " · "}
        리뷰 {summary.review_count}개 기반
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {summary.summary_text}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {summary.positive_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">좋아요</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.positive_points.map((point, i) => (
                <li key={`p-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.negative_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">아쉬워요</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.negative_points.map((point, i) => (
                <li key={`n-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.recommended_for.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">이런 분께 추천</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.recommended_for.map((point, i) => (
                <li key={`r-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        AI가 리뷰를 바탕으로 요약한 내용입니다.
      </p>
    </div>
  );
}
