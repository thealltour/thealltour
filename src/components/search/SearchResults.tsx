"use client";

import Link from "next/link";
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

export type SearchResultsProps = {
  products: Product[];
};

/**
 * 검색 결과 상품 그리드만 렌더링.
 * 빈 결과는 SearchEmpty 사용.
 */
export default function SearchResults({ products }: SearchResultsProps) {
  if (products.length === 0) return null;

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
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
          </Link>
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
      aria-label="검색 결과 상품 목록"
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
              analyticsSection="search"
              productId={product.id}
            />
          </li>
        );
      })}
    </ul>
  );
}
