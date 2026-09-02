"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProductCardSource } from "@/lib/products/productListItem";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
} from "@/lib/productCategory";
import {
  normalizeProductCatalogSearchKeyword,
  productCatalogMatchesKeyword,
} from "@/lib/products/productCatalogKeyword";
import { getCollectionLabel } from "@/lib/productFilters";

/** 테마 칩 전체 (matchesThemeTab / getThemeTabs 와 동일) */
const THEME_ALL_LABEL = "전체";

type ProductCatalogSectionProps = {
  products: ProductCardSource[];
  /**
   * Browse server pagination: taxonomy theme names for grouping (not derived from page products).
   * When omitted, theme groups are inferred from `products` (legacy / related layouts).
   */
  themeChipOptions?: string[];
  /** Authoritative total (Browse getProductsPage.totalCount). Falls back to filtered length. */
  listTotalCount?: number;
  /**
   * When true (Browse DB-paginated), skip client keyword re-filter.
   * Default: true whenever listTotalCount is provided.
   */
  skipClientKeywordFilter?: boolean;
  initialKeyword?: string;
  golfChannelPreset?: boolean;
  presetLabel?: string;
  /** URL 연동 시 초기 지역(상품 category 문자열) */
  initialRegion?: string | null;
  /** URL 연동 시 초기 테마 */
  initialTheme?: string | null;
  /** URL 연동 시 초기 컬렉션 */
  initialCollection?: string | null;
  /** URL 연동 시 컬렉션 해제 콜백 */
  onClearCollection?: () => void;
  /** 결과 0건일 때 필터 초기화 CTA */
  onResetFilters?: () => void;
  /** list: /products 목록형. related: 연관·랜딩용 카드 그리드 */
  cardLayout?: "list" | "related";
};

export default function ProductCatalogSection({
  products,
  themeChipOptions,
  listTotalCount,
  skipClientKeywordFilter,
  initialKeyword = "",
  presetLabel,
  initialRegion,
  initialTheme,
  initialCollection,
  onClearCollection,
  onResetFilters,
  cardLayout = "list",
}: ProductCatalogSectionProps) {
  const isBrowsePaginated = typeof listTotalCount === "number";
  const omitKeywordFilter = skipClientKeywordFilter === true || isBrowsePaginated;

  const keyword = useMemo(
    () => normalizeProductCatalogSearchKeyword(initialKeyword),
    [initialKeyword],
  );
  const baseProducts = useMemo(() => products, [products]);

  const filteredProducts = useMemo(() => {
    if (isBrowsePaginated) return baseProducts;
    const regionTab = initialRegion ?? "all";
    return baseProducts.filter((product) => matchesProductTab(product, regionTab));
  }, [baseProducts, initialRegion, isBrowsePaginated]);

  const themeTabs = useMemo(() => {
    if (themeChipOptions?.length) {
      return Array.from(new Set([THEME_ALL_LABEL, ...themeChipOptions.filter(Boolean)]));
    }
    const regionTab = initialRegion ?? "all";
    const inferred = getThemeTabs(baseProducts, regionTab);
    return Array.from(new Set(inferred));
  }, [themeChipOptions, baseProducts, initialRegion]);

  const themeFilteredProducts = useMemo(() => {
    if (isBrowsePaginated) return filteredProducts;
    return filteredProducts.filter((product) =>
      matchesThemeTab(product, initialTheme ?? THEME_ALL_LABEL),
    );
  }, [filteredProducts, initialTheme, isBrowsePaginated]);

  const keywordFilteredProducts = useMemo(() => {
    const pool = isBrowsePaginated ? filteredProducts : themeFilteredProducts;
    if (omitKeywordFilter) return pool;
    return pool.filter((product) => productCatalogMatchesKeyword(product, keyword));
  }, [isBrowsePaginated, filteredProducts, themeFilteredProducts, keyword, omitKeywordFilter]);

  const displayTotalCount =
    typeof listTotalCount === "number" ? listTotalCount : keywordFilteredProducts.length;

  const groupedByTheme = useMemo(
    () => groupProductsByTheme(keywordFilteredProducts, themeTabs),
    [keywordFilteredProducts, themeTabs],
  );

  const displayGroups = useMemo(
    () =>
      groupedByTheme.length > 0
        ? groupedByTheme
        : keywordFilteredProducts.length > 0
          ? [{ theme: "상품", products: keywordFilteredProducts }]
          : [],
    [groupedByTheme, keywordFilteredProducts],
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();

  function handleProductConsult(product: ProductCardSource) {
    const query = searchParams.toString();
    openModal({
      productId: product.id,
      productTitle: product.title,
      sourcePath: query ? `${pathname}?${query}` : pathname,
    });
  }

  const regionSummary = initialRegion ?? "전체";
  const collectionLabel = getCollectionLabel(initialCollection ?? null);

  const summaryParts = [`총 ${displayTotalCount}개`, `지역 ${regionSummary}`];
  if (presetLabel) summaryParts.push(`프리셋: ${presetLabel}`);
  if (keyword) summaryParts.push(`검색어: ${initialKeyword}`);
  if (collectionLabel) summaryParts.push(`컬렉션: ${collectionLabel}`);

  return (
    <section className="space-y-4">
      <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
        {summaryParts.join(" · ")}
      </p>

      <div key={`${initialRegion ?? "all"}-${initialTheme ?? THEME_ALL_LABEL}`} className="fade-in-up space-y-5">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
            {(initialRegion ||
              initialTheme ||
              (initialKeyword && initialKeyword.trim()) ||
              initialCollection) &&
            (onResetFilters || onClearCollection) ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">
                  선택한 조건에 맞는 상품이 없습니다.
                </p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {[
                    initialRegion && `지역: ${initialRegion}`,
                    initialTheme && `테마: ${initialTheme}`,
                    initialKeyword?.trim() && `검색어: ${initialKeyword.trim()}`,
                    collectionLabel && `컬렉션: ${collectionLabel}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {onClearCollection && initialCollection ? (
                    <button
                      type="button"
                      onClick={onClearCollection}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    >
                      컬렉션 해제
                    </button>
                  ) : null}
                  <Link
                    href="/products"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90",
                      solidButtonShadowClasses,
                    )}
                  >
                    전체 상품 보기
                  </Link>
                  {onResetFilters ? (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    >
                      필터 초기화
                    </button>
                  ) : null}
                </div>
              </>
            ) : keyword ? (
              "검색 조건에 맞는 상품이 없습니다."
            ) : (
              "표시할 상품이 없습니다. 필터를 조정해 보세요."
            )}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              {cardLayout === "related" ? (
                <ProductCardGridSection desktopGridCols={2} className="w-full max-w-[1344px]">
                  {group.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: "landing_catalog",
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              ) : (
                <div className="flex w-full max-w-[1344px] flex-col gap-4 md:gap-5">
                  {group.products.map((product) => {
                    const catalogOverrides = {
                      analyticsSource: "product_list" as const,
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                      /** /destinations 추천 카드와 동일하게 대표 배지 최대 2개(이미지 오버레이) */
                      campaignBadgeMax: 2,
                    };

                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "list",
                            })}
                          />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "mobile",
                            })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
