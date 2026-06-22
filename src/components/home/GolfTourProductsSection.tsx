import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { HomeProductCard } from "@/components/products/HomeProductCard";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
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
 * 홈 골프투어 추천 섹션 — 메인 추천상품과 동일한 HomeProductCard UI.
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
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
    >
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        action={
          <Link
            href={href}
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="골프투어 상품 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
      />
      <ProductCardGridSection homeCuratedMobileCompact desktopGridCols={4}>
        {products.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            analyticsSection="추천 골프투어"
          />
        ))}
      </ProductCardGridSection>
    </SectionBlock>
  );
}
