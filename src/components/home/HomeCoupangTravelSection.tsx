import { SectionBlock } from "@/components/layout/SectionBlock";
import { HOME_MAIN_SECTION_BLOCK_CLASS, SectionHeader } from "@/components/layout/SectionHeader";
import { CoupangTravelSection } from "@/components/affiliate/CoupangTravelSection";
import {
  COUPANG_SECTION_MAX_WIDTH_CLASS,
} from "@/lib/affiliate/coupangBannerConfig";
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
      <div className={cn("mx-auto w-full space-y-2.5 sm:space-y-3", COUPANG_SECTION_MAX_WIDTH_CLASS)}>
        <SectionHeader
          eyebrow="제휴 · 쿠팡 파트너스"
          title="더 많은 여행상품 둘러보기"
          description="쿠팡에서 판매 중인 여행상품을 확인해보세요."
          titleId="home-coupang-travel-heading"
          align="left"
        />
        <CoupangTravelSection hideHeader />
      </div>
    </SectionBlock>
  );
}
