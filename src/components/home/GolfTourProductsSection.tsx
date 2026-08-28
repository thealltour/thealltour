import { HomeSectionMoreLink } from "@/components/home/HomeSectionMoreLink";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import { cn } from "@/lib/cn";
import type { Product } from "@/types/product";

export type GolfTourProductsSectionProps = {
  products: Product[];
  moreHref?: string;
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  className?: string;
};

/**
 * 홈 골프투어 추천 섹션 — HomeProductCard 1행 가로 레일.
 */
export default function GolfTourProductsSection({
  products,
  moreHref,
  eyebrow,
  title,
  description,
  className,
}: GolfTourProductsSectionProps) {
  if (products.length === 0) return null;

  const href = moreHref?.trim() || buildGolfProductsHref();

  return (
    <SectionBlock
      id="home-golf-tours"
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, "scroll-mt-24", className)}
    >
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        action={
          <HomeSectionMoreLink
            href={href}
            section="golf"
            label="더보기"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            ariaLabel="골프투어 상품 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </HomeSectionMoreLink>
        }
      />
      <HomeProductCardRail
        products={products}
        analyticsSection="추천 골프투어"
        listAriaLabel="추천 골프투어 상품"
      />
    </SectionBlock>
  );
}
