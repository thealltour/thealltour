import { SectionBlock } from "@/components/layout/SectionBlock";
import { HOME_MAIN_SECTION_BLOCK_CLASS } from "@/components/layout/SectionHeader";
import { CoupangTravelSection } from "@/components/affiliate/CoupangTravelSection";
import { cn } from "@/lib/cn";

export type HomeCoupangTravelSectionProps = {
  className?: string;
};

/** 홈 Theme → Reviews 사이 쿠팡 파트너스 여행상품 섹션 */
export function HomeCoupangTravelSection({ className }: HomeCoupangTravelSectionProps) {
  return (
    <SectionBlock
      id="home-coupang-travel"
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, "scroll-mt-24", className)}
    >
      <CoupangTravelSection headingId="home-coupang-travel-heading" />
    </SectionBlock>
  );
}
