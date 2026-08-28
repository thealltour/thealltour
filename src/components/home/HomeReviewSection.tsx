import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MORE_LINK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeSectionMoreLink } from "@/components/home/HomeSectionMoreLink";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import type { Review } from "@/types/review";

export type HomeReviewSectionProps = {
  reviews: Review[];
  className?: string;
};

/**
 * 홈 리뷰 하이라이트 섹션. 여행자들의 실제 후기 + 카드 4개.
 */
export function HomeReviewSection({ reviews, className }: HomeReviewSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-2 sm:space-y-4 !px-4 !py-1.5 sm:!px-6 sm:!py-3 md:!px-8 md:!py-4", className)}
    >
      <SectionHeader
        title="여행자들의 실제 후기"
        description="실제 여행객들의 생생한 후기를 만나보세요."
        action={
          <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-3 sm:gap-y-1">
            <HomeSectionMoreLink
              href="/reviews"
              section="reviews"
              label="후기 전체 보기"
              className={SECTION_HEADER_MORE_LINK_CLASS}
              ariaLabel="여행 후기 더보기"
            >
              후기 전체 보기
              <span aria-hidden>→</span>
            </HomeSectionMoreLink>
            <Link href="/reviews/write" className={SECTION_HEADER_MORE_LINK_CLASS}>
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
