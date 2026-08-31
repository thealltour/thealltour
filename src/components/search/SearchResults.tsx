"use client";

import type { ProductCardSource } from "@/lib/products/productListItem";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type SearchResultsProps = {
  products: ProductCardSource[];
};

/**
 * 검색 결과 상품 그리드.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export default function SearchResults({ products }: SearchResultsProps) {
  if (products.length === 0) return null;

  return (
    <section aria-label="검색 결과 상품 목록">
      <ProductCardGridSection>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "search",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
