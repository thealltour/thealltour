"use client";

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
 * 모바일 2열 / 데스크톱 4열 그리드. 상품 수만큼만 표시.
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

      <ul
        aria-label={listAriaLabel}
        className="mx-auto grid w-full max-w-[1344px] grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 lg:grid-cols-4"
      >
        {section.products.map((product) => (
          <li key={product.id} className="min-w-0">
            <HomeProductCard
              product={product}
              analyticsSection={analyticsSection}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
