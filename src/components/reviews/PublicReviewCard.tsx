/**
 * PR6: 공개 리뷰 목록용 카드.
 * - 인증 후기 배지, summary, 썸네일 최대 3장.
 * - PR8: 도움됨 버튼.
 * - PR9: ⋯ 메뉴 → 신고하기.
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
  return d.toLocaleDateString("ko-KR");
}

function Stars({ rating }: { rating?: number }) {
  if (rating == null || rating < 1 || rating > 5) {
    return <span className="text-sm text-slate-400">별점 없음</span>;
  }
  const r = Math.round(rating);
  return (
    <span className="text-amber-500">
      {"★".repeat(r)}
      <span className="text-slate-300">{"☆".repeat(5 - r)}</span>
    </span>
  );
}

export default function PublicReviewCard({ review }: { review: PublicReviewItem }) {
  const images = review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [];
  const thumbnails = images.slice(0, 3);
  const verified = isVerifiedReview(review);
  const body = review.summary?.trim() || review.content?.trim() || "";

  return (
    <Link href={`/reviews/${review.id}`}>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
        {thumbnails.length > 0 ? (
          <div className="relative h-40 w-full overflow-hidden">
            <Image
              src={thumbnails[0]}
              alt={review.product_title ? `${review.product_title} 여행 후기 사진` : "여행 후기 사진"}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
              loading="lazy"
            />
            {verified && (
              <span className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                인증된 여행 후기
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center bg-slate-100">
            {verified ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                인증된 여행 후기
              </span>
            ) : (
              <span className="text-sm text-slate-400">이미지 없음</span>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 font-semibold text-slate-900">{review.title}</h2>
            <div className="flex shrink-0 items-start gap-1">
              <ReviewCardReportButton
                reviewId={review.id}
                viewerReported={review.viewerReported}
              />
              <div className="text-right">
                <Stars rating={review.rating} />
                <p className="mt-1 text-xs text-slate-500">{formatDate(review.created_at)}</p>
              </div>
            </div>
          </div>
          {review.summary && (
            <p className="line-clamp-1 text-sm text-slate-600">{review.summary}</p>
          )}
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
            {body.slice(0, 150)}
            {body.length > 150 ? "…" : ""}
          </p>
          {review.product_title && (
            <p className="text-xs text-slate-500">상품: {review.product_title}</p>
          )}
          {thumbnails.length > 1 && (
            <div className="mt-2 flex gap-1">
              {thumbnails.slice(1, 3).map((url, i) => (
                <div key={`${url}-${i}`} className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100">
                  <Image src={url} alt="" fill sizes="48px" className="object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs font-medium text-blue-600">작성자: {review.author_name}</p>
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
