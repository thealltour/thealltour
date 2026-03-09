/**
 * PR6: 공개 리뷰 목록용 카드.
 * - 별점 강조, 작성자/날짜, 신뢰 배지(인증/사진/평점), 한줄요약·본문 요약.
 * - 좋았던 점/아쉬운 점/팁 있으면 요약 표시.
 * - PR8: 도움됨 버튼, PR9: 신고하기.
 */
import Image from "next/image";
import Link from "next/link";
import type { PublicReviewItem } from "@/types/review";
import { isVerifiedReview } from "@/lib/reviewStats";
import ReviewHelpfulButton from "./ReviewHelpfulButton";
import ReviewCardReportButton from "./ReviewCardReportButton";

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function Stars({ rating, size = "md" }: { rating?: number; size?: "sm" | "md" }) {
  if (rating == null || rating < 1 || rating > 5) {
    return <span className="text-sm text-slate-400">별점 없음</span>;
  }
  const r = Math.round(rating);
  const starClass = size === "md" ? "text-lg" : "text-base";
  return (
    <span className={`inline-flex items-center gap-0.5 ${starClass} text-amber-500`} aria-label={`${r}점`}>
      {"★".repeat(r)}
      <span className="text-slate-200">{"☆".repeat(5 - r)}</span>
      <span className="ml-1 text-sm font-semibold text-slate-700">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function PublicReviewCard({ review }: { review: PublicReviewItem }) {
  const images = review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [];
  const thumbnails = images.slice(0, 3);
  const verified = isVerifiedReview(review);
  const hasPhotos = thumbnails.length > 0;
  const body = review.summary?.trim() || review.content?.trim() || "";
  const bodyPreview = body.slice(0, 180);
  const hasMore = body.length > 180;
  const hasStructured = !!(review.content_good?.trim() || review.content_bad?.trim() || review.content_tip?.trim());

  return (
    <Link href={`/reviews/${review.id}`}>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
        {thumbnails.length > 0 ? (
          <div className="relative h-36 w-full overflow-hidden">
            <Image
              src={thumbnails[0]}
              alt={review.product_title ? `${review.product_title} 여행 후기 사진` : "여행 후기 사진"}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
              loading="lazy"
            />
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {verified && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                  실제 여행 후기
                </span>
              )}
              {hasPhotos && (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
                  사진 포함
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center bg-slate-50">
            <div className="flex flex-wrap justify-center gap-1">
              {verified && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  실제 여행 후기
                </span>
              )}
              {!hasPhotos && <span className="text-xs text-slate-400">이미지 없음</span>}
            </div>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-semibold text-slate-900">{review.title || "여행 후기"}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Stars rating={review.rating} />
                <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
              </div>
            </div>
            <div className="shrink-0">
              <ReviewCardReportButton reviewId={review.id} viewerReported={review.viewerReported} />
            </div>
          </div>
          {review.summary && (
            <p className="line-clamp-2 text-sm font-medium text-slate-700">{review.summary}</p>
          )}
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
            {bodyPreview}
            {hasMore ? "…" : ""}
          </p>
          {hasStructured && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              {review.content_good?.trim() && (
                <p className="line-clamp-1"><span className="font-medium text-green-700">좋았던 점</span> {review.content_good}</p>
              )}
              {review.content_bad?.trim() && (
                <p className="line-clamp-1"><span className="font-medium text-amber-700">아쉬운 점</span> {review.content_bad}</p>
              )}
              {review.content_tip?.trim() && (
                <p className="line-clamp-1"><span className="font-medium text-blue-700">팁</span> {review.content_tip}</p>
              )}
            </div>
          )}
          {review.product_title && (
            <p className="text-xs text-slate-500">상품: {review.product_title}</p>
          )}
          {thumbnails.length > 1 && (
            <div className="flex gap-1">
              {thumbnails.slice(1, 3).map((url, i) => (
                <div key={`${url}-${i}`} className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
                  <Image src={url} alt="" fill sizes="40px" className="object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">작성자: {review.author_name || "익명"}</span>
            <span className="text-xs font-medium text-blue-600">자세히 보기 →</span>
            <ReviewHelpfulButton
              reviewId={review.id}
              helpfulCount={review.helpfulCount}
              viewerVotedHelpful={review.viewerVotedHelpful}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
