"use client";

import { HomeProductCardGrid } from "@/components/products/HomeProductCardGrid";
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
 * 홈 공통 그리드(모바일·태블릿 2열 / 데스크톱 4열).
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
    <div className={cn("space-y-2.5 md:space-y-3", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}

      <HomeProductCardGrid
        products={section.products}
        analyticsSection={analyticsSection}
        listAriaLabel={listAriaLabel}
      />
    </div>
  );
}
