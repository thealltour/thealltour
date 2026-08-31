"use client";

import type { ProductCardSource } from "@/lib/products/productListItem";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type RelatedProductsSectionProps = {
  /** 섹션 제목. 결과 있음: "이런 상품도 있어요", 결과 없음: "추천 여행 상품" 등 */
  title?: string;
  products: ProductCardSource[];
};

/**
 * 검색 결과 페이지 하단 추천 상품.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export default function RelatedProductsSection({
  title = "이런 상품도 있어요",
  products,
}: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="related-products-heading" className="space-y-4">
      <h2
        id="related-products-heading"
        className="heading-display type-h3 text-[var(--foreground)]"
      >
        {title}
      </h2>
      <ProductCardGridSection>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "search_related",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
