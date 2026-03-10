"use client";

import type { Product } from "@/types/product";
import ProductCardV2 from "@/components/products/ProductCardV2";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import type { ProductCardV2Status } from "@/components/products/ProductCardV2";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import { cn } from "@/lib/cn";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

function buildV2Badges(
  product: Product,
  themeBadges: string[],
): { type: string; label: string; priority?: number; isActive?: boolean }[] {
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type RelatedProductsSectionProps = {
  /** 섹션 제목. 결과 있음: "이런 상품도 있어요", 결과 없음: "추천 여행 상품" 등 */
  title?: string;
  products: Product[];
};

/**
 * 검색 결과 페이지 하단 추천 상품 그리드.
 * ProductCardV2 재사용, analyticsSection="search_related".
 */
export default function RelatedProductsSection({
  title = "이런 상품도 있어요",
  products,
}: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <section className="space-y-4">
        <h2 className="heading-display type-h3 text-[var(--foreground)]">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]"
            >
              <div className="relative aspect-[16/10] w-full bg-[var(--surface-muted)]">
                <img
                  src={product.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold text-[var(--foreground)] line-clamp-2">{product.title}</p>
                {typeof product.price === "number" && (
                  <p className="mt-2 font-semibold text-[var(--primary)]">
                    {new Intl.NumberFormat("ko-KR").format(product.price)}원~
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="related-products-heading" className="space-y-4">
      <h2
        id="related-products-heading"
        className="heading-display type-h3 text-[var(--foreground)]"
      >
        {title}
      </h2>
      <ul
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
        aria-label="추천 상품 목록"
      >
        {products.map((product) => {
          const badges = getProductBadges(product);
          const hashtags = parseMetaTitleAsHashtags(product.meta_title);
          const status: ProductCardV2Status = product.status ?? "AVAILABLE";
          return (
            <li key={product.id}>
              <ProductCardV2
                layout="grid"
                title={product.title}
                price={product.price}
                duration={product.duration}
                region={product.category}
                categories={[product.category]}
                tags={hashtags}
                status={status}
                badges={buildV2Badges(product, badges)}
                thumbnailUrl={product.image_url}
                priceMeta={product.price_meta ?? "1인 기준"}
                metaInfo={product.meta_info ?? ""}
                hrefDetail={`/products/${product.id}`}
                analyticsSource="product_list"
                analyticsSection="search_related"
                productId={product.id}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
