"use client";

import { HomeProductCard } from "@/components/products/HomeProductCard";
import type { ProductCardSource } from "@/lib/products/productListItem";
import { cn } from "@/lib/cn";

export type HomeProductCardGridProps = {
  products: ProductCardSource[];
  /** 홈 카드 클릭 계측 section */
  analyticsSection?: string;
  listAriaLabel?: string;
  className?: string;
};

/** 홈 큐레이션·골프 공통: 모바일/태블릿 2열, 데스크톱 4열 */
export const HOME_PRODUCT_CARD_GRID_CLASS =
  "mx-auto grid w-full max-w-[1344px] grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 lg:grid-cols-4";

/**
 * 홈 상품 카드 그리드. 상품 수와 무관하게 동일 열 폭을 쓰고, 있는 상품만 렌더한다.
 * 가로 레일(`HomeProductCardRail`)과는 별도 — 랜딩/광고 레일에 영향 없음.
 */
export function HomeProductCardGrid({
  products,
  analyticsSection,
  listAriaLabel = "추천 상품",
  className,
}: HomeProductCardGridProps) {
  if (products.length === 0) return null;

  return (
    <ul aria-label={listAriaLabel} className={cn(HOME_PRODUCT_CARD_GRID_CLASS, className)}>
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <HomeProductCard
            product={product}
            variant="grid"
            analyticsSection={analyticsSection}
          />
        </li>
      ))}
    </ul>
  );
}
