"use client";

import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
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
 * Mobile: Home Discovery Rail (Golf와 동일 preset) / Desktop: 4-column grid.
 */
export function CuratedSectionScrollBlock({
  section,
  showTitle = false,
  className,
}: CuratedSectionScrollBlockProps) {
  if (section.products.length === 0) return null;

  const analyticsSection = section.title ?? undefined;
  const listAriaLabel = section.title ? `${section.title} 상품` : "추천 패키지 상품";

  return (
    <div className={cn("space-y-3 md:space-y-4", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}

      <div className="md:hidden">
        <HomeProductCardRail
          products={section.products}
          analyticsSection={analyticsSection}
          listAriaLabel={listAriaLabel}
        />
      </div>

      <div className="mx-auto hidden w-full max-w-[1344px] md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {section.products.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            analyticsSection={analyticsSection}
          />
        ))}
      </div>
    </div>
  );
}
