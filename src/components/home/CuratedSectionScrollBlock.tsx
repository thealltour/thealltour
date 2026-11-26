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

/** 상품 수에 맞춰 데스크톱 열 수를 줄여 빈 칸이 덜 보이게 한다. */
function desktopGridClass(count: number): string {
  if (count <= 1) return "lg:grid-cols-1 lg:max-w-[336px] lg:mx-0";
  if (count === 2) return "lg:grid-cols-2 lg:max-w-[688px] lg:mx-0";
  if (count === 3) return "lg:grid-cols-3 lg:max-w-[1024px] lg:mx-0";
  return "lg:grid-cols-4";
}

/**
 * 추천 여행 단일 섹션.
 * 모바일 2열 / 데스크톱은 상품 수에 맞는 열 (최대 4열).
 */
export function CuratedSectionScrollBlock({
  section,
  showTitle = false,
  className,
}: CuratedSectionScrollBlockProps) {
  if (section.products.length === 0) return null;

  const count = section.products.length;
  const analyticsSection = section.title ?? undefined;
  const listAriaLabel = section.title ? `${section.title} 상품` : "추천 패키지 상품";

  return (
    <div className={cn("space-y-2.5 md:space-y-3", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}

      <ul
        aria-label={listAriaLabel}
        className={cn(
          "mx-auto grid w-full max-w-[1344px] grid-cols-2 gap-2.5 sm:gap-3 md:gap-4",
          desktopGridClass(count),
        )}
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
