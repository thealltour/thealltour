import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import type { Review } from "@/types/review";

export type HomeReviewSectionProps = {
  reviews: Review[];
  className?: string;
};

/**
 * 홈 리뷰 하이라이트 섹션. TRAVEL REVIEWS / 여행자들의 실제 후기 + 카드 4개.
 */
export function HomeReviewSection({ reviews, className }: HomeReviewSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={className}>
      <SectionHeader
        eyebrow="TRAVEL REVIEWS"
        title="여행자들의 실제 후기"
        description="실제 여행객들의 생생한 후기를 만나보세요."
        align="left"
      />
      <ul
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="리뷰 하이라이트"
      >
        {reviews.map((review) => (
          <li key={review.id}>
            <ReviewHighlightCard review={review} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/reviews"
          className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
        >
          후기 전체 보기
        </Link>
        <Link
          href="/reviews/write"
          className="type-btn inline-flex rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-white transition hover:bg-[#0F172A]"
        >
          후기 작성하기
        </Link>
      </div>
    </SectionBlock>
  );
}
