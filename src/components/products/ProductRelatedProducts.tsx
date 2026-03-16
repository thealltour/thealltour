"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type ProductRelatedProductsProps = {
  /** 현재 상품 ID (목록에서 제외용, 컴포넌트는 이미 제외된 products만 받음) */
  currentProductId: string;
  /** 추천 상품 목록 (최대 6개 권장) */
  products: Product[];
  /** 섹션 제목 */
  title?: string;
};

const DEFAULT_TITLE = "이 여행과 비슷한 상품";

/**
 * PR31: 상품 상세 하단 추천 여행 상품.
 * 모바일 가로 스크롤 + 데스크톱 그리드, 기존 ProductCard 재사용.
 */
export function ProductRelatedProducts({
  currentProductId,
  products,
  title = DEFAULT_TITLE,
}: ProductRelatedProductsProps) {
  const list = products.filter((p) => p.id?.trim() !== currentProductId?.trim()).slice(0, 6);
  if (list.length === 0) return null;

  return (
    <section
      className="mt-8 w-full px-4 md:px-0"
      aria-labelledby="related-products-heading"
    >
      <h2
        id="related-products-heading"
        className="mb-4 text-lg font-semibold text-slate-900"
      >
        {title}
      </h2>
      <div>
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
      </div>
    </section>
  );
}
