"use client";

import type { ProductCardSource } from "@/lib/products/productListItem";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type RelatedProductsSectionProps = {
  /** 섹션 제목 */
  title?: string;
  /** 설명 문구 1줄 */
  description?: string;
  /** 연관 상품 목록 (현재 상품 제외된 상태로 넘어옴) */
  products?: ProductCardSource[];
};

const DEFAULT_TITLE = "이 상품과 비슷한 여행";
const DEFAULT_DESCRIPTION = "여행지, 테마, 상품 구성이 비슷한 상품을 모아봤어요.";

/**
 * PR43: 상품 상세 하단 연관 상품 섹션.
 * 기존 ProductCard + ProductCardGridSection 재사용, 모바일 가로 스크롤 + 데스크톱 그리드.
 */
export default function RelatedProductsSection({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  products = [],
}: RelatedProductsSectionProps) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return null;

  return (
    <section
      className="mt-8 w-full px-4 md:px-0"
      aria-labelledby="related-products-section-heading"
    >
      <div className="space-y-1 mb-4">
        <h2
          id="related-products-section-heading"
          className="text-lg font-bold text-slate-900"
        >
          {title}
        </h2>
        {description?.trim() && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>

      <ProductCardGridSection>
        {list.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "related_products",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
