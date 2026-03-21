import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader, SECTION_HEADER_CTA_CLASS } from "@/components/layout/SectionHeader";
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
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-2 sm:space-y-4 !p-3 sm:!p-6 md:!p-8", className)}
    >
      <SectionHeader
        eyebrow="TRAVEL REVIEWS"
        title="여행자들의 실제 후기"
        description="실제 여행객들의 생생한 후기를 만나보세요."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/reviews" className={SECTION_HEADER_CTA_CLASS}>
              후기 전체 보기 →
            </Link>
            <Link
              href="/reviews/write"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--foreground)] hover:underline"
            >
              후기 작성하기
            </Link>
          </div>
        }
        align="left"
      />
      <ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="리뷰 하이라이트"
      >
        {reviews.map((review) => (
          <li key={review.id}>
            <ReviewHighlightCard review={review} />
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}
