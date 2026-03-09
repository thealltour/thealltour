import Link from "next/link";
import Image from "next/image";
import type { Review } from "@/types/review";
import { Star } from "lucide-react";

export type ReviewHighlightCardProps = {
  review: Review;
  /** 연결된 상품이 있으면 상품 상세 #reviews 로 링크 */
  productId?: string | null;
  className?: string;
};

function getReviewHref(review: Review, productId?: string | null): string {
  if (productId?.trim()) return `/products/${encodeURIComponent(productId.trim())}#reviews`;
  return `/reviews/${review.id}`;
}

/**
 * 단일 리뷰 하이라이트 카드. author_name, rating, summary, image 표시.
 */
export function ReviewHighlightCard({
  review,
  productId,
  className,
}: ReviewHighlightCardProps) {
  const href = getReviewHref(review, productId);
  const imageUrl =
    review.image_url?.trim() ||
    (Array.isArray(review.image_urls) && review.image_urls[0]?.trim()
      ? review.image_urls[0].trim()
      : "");

  return (
    <Link
      href={href}
      className={
        className ??
        "flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] sm:p-5 sm:rounded-3xl"
      }
    >
      {imageUrl ? (
        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-[var(--surface-muted)]">
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
      ) : null}
      {typeof review.rating === "number" ? (
        <div
          className="flex items-center gap-0.5 text-[var(--primary)]"
          aria-label={`별점 ${review.rating}점`}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i <= review.rating! ? "fill-current" : "fill-none"}`}
              aria-hidden
            />
          ))}
          <span className="ml-1 type-caption font-semibold text-[var(--foreground)]">
            {review.rating}
          </span>
        </div>
      ) : null}
      <h3 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
        {review.title || "후기"}
      </h3>
      {review.summary ? (
        <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
          {review.summary}
        </p>
      ) : null}
      {review.author_name?.trim() ? (
        <p className="mt-2 type-caption text-[var(--text-muted)]">
          — {review.author_name.trim()}
        </p>
      ) : null}
      <span className="mt-3 inline-flex items-center section-label text-[var(--primary)]">
        자세히 보기
        <span className="ml-1" aria-hidden>→</span>
      </span>
    </Link>
  );
}
