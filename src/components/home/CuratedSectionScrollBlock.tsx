"use client";

import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { HomeProductCard } from "@/components/products/HomeProductCard";
import type { HomeCuratedSectionWithProducts } from "@/types/homeCurated";
import { cn } from "@/lib/cn";

export type CuratedSectionScrollBlockProps = {
  section: HomeCuratedSectionWithProducts;
  /** 섹션 제목 노출 여부 (2개 이상 섹션일 때) */
  showTitle?: boolean;
  className?: string;
};

/**
 * 추천 여행 단일 섹션.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export function CuratedSectionScrollBlock({
  section,
  showTitle = false,
  className,
}: CuratedSectionScrollBlockProps) {
  if (section.products.length === 0) return null;

  return (
    <div className={cn("space-y-2 sm:space-y-4", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}
      <ProductCardGridSection homeCuratedMobileCompact>
        {section.products.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            analyticsSection={section.title ?? undefined}
          />
        ))}
      </ProductCardGridSection>
    </div>
  );
}
