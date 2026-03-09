import Link from "next/link";
import type { Review } from "@/types/review";
import { Star } from "lucide-react";

export type ReviewHighlightGridProps = {
  reviews: Review[];
  className?: string;
};

/**
 * 홈용 리뷰 하이라이트 그리드. author_name, title, summary, rating 표시.
 */
export function ReviewHighlightGrid({ reviews, className }: ReviewHighlightGridProps) {
  if (reviews.length === 0) return null;

  return (
    <ul
      className={className ?? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"}
      aria-label="리뷰 하이라이트"
    >
      {reviews.map((review) => (
        <li key={review.id}>
          <Link
            href={`/reviews/${review.id}`}
            className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] sm:p-5 sm:rounded-3xl"
          >
            {typeof review.rating === "number" ? (
              <div className="mb-2 flex items-center gap-0.5 text-[var(--primary)]" aria-label={`별점 ${review.rating}점`}>
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
            <h3 className="font-card-title line-clamp-2 type-small font-semibold text-[var(--foreground)]">
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
        </li>
      ))}
    </ul>
  );
}
