"use client";

import { useMemo, useState, useEffect } from "react";
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
  type ProductCategoryTabId,
} from "@/lib/productCategory";
import {
  normalizeProductCatalogSearchKeyword,
  productCatalogMatchesKeyword,
} from "@/lib/products/productCatalogKeyword";
import { getCollectionLabel } from "@/lib/productFilters";

/** 지역 칩 첫 항목 라벨 (내부 탭 id는 `all`) */
const REGION_ALL_LABEL = "전체";
/** 테마 칩 전체 (matchesThemeTab / getThemeTabs 와 동일) */
const THEME_ALL_LABEL = "전체";

type ProductCatalogSectionProps = {
  products: ProductCardSource[];
  categories: string[];
  /**
   * Browse server pagination: taxonomy theme names for chips (not derived from page products).
   * When omitted, theme chips are inferred from `products` (legacy / related layouts).
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
  /** URL 연동 시 지역 변경 콜백 */
  onCategoryChange?: (region: string | null) => void;
  /** URL 연동 시 테마 변경 콜백 */
  onThemeChange?: (theme: string | null) => void;
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
  categories,
  themeChipOptions,
  listTotalCount,
  skipClientKeywordFilter,
  initialKeyword = "",
  golfChannelPreset = false,
  presetLabel,
  initialRegion,
  initialTheme,
  onCategoryChange,
  onThemeChange,
  initialCollection,
  onClearCollection,
  onResetFilters,
  cardLayout = "list",
}: ProductCatalogSectionProps) {
  const [internalTab, setInternalTab] = useState<ProductCategoryTabId>("all");
  const [internalThemeTab, setInternalThemeTab] = useState(THEME_ALL_LABEL);

  const isUrlControlled = onCategoryChange != null && onThemeChange != null;
  const omitKeywordFilter =
    skipClientKeywordFilter === true || typeof listTotalCount === "number";
  const activeTab: ProductCategoryTabId = isUrlControlled
    ? (initialRegion ?? "all")
    : internalTab;
  const activeThemeTab = isUrlControlled ? (initialTheme ?? THEME_ALL_LABEL) : internalThemeTab;

  useEffect(() => {
    if (!isUrlControlled) return;
    setInternalTab(initialRegion ?? "all");
    setInternalThemeTab(initialTheme ?? THEME_ALL_LABEL);
  }, [isUrlControlled, initialRegion, initialTheme]);

  const keyword = useMemo(
    () => normalizeProductCatalogSearchKeyword(initialKeyword),
    [initialKeyword],
  );
  const baseProducts = useMemo(() => products, [products]);
  const categoryTabs = useMemo(() => [REGION_ALL_LABEL, ...categories], [categories]);

  const filteredProducts = useMemo(() => {
    if (isUrlControlled) return baseProducts;
    return baseProducts.filter((product) => matchesProductTab(product, activeTab));
  }, [baseProducts, activeTab, isUrlControlled]);

  const themeTabs = useMemo(() => {
    if (themeChipOptions?.length) {
      return Array.from(new Set([THEME_ALL_LABEL, ...themeChipOptions.filter(Boolean)]));
    }
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(inferred));
  }, [themeChipOptions, baseProducts, activeTab]);

  const themeFilteredProducts = useMemo(() => {
    if (isUrlControlled) return filteredProducts;
    return filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab));
  }, [filteredProducts, activeThemeTab, isUrlControlled]);

  const keywordFilteredProducts = useMemo(() => {
    const pool = isUrlControlled ? filteredProducts : themeFilteredProducts;
    if (omitKeywordFilter) return pool;
    return pool.filter((product) => productCatalogMatchesKeyword(product, keyword));
  }, [isUrlControlled, filteredProducts, themeFilteredProducts, keyword, omitKeywordFilter]);

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

  const regionSummary = activeTab === "all" ? REGION_ALL_LABEL : activeTab;
  const collectionLabel = getCollectionLabel(initialCollection ?? null);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {displayTotalCount}개 · 지역 {regionSummary}
          </p>
          {presetLabel ? (
            <p className="text-xs leading-snug text-[#15803d] sm:text-sm">프리셋: {presetLabel}</p>
          ) : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">
              검색어: {initialKeyword}
            </p>
          ) : null}
          {collectionLabel ? (
            <p className="text-xs leading-snug text-[var(--text-secondary)] sm:text-sm">
              컬렉션: {collectionLabel}
            </p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (isUrlControlled && onCategoryChange) {
                  onCategoryChange(tab === REGION_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalTab(tab === REGION_ALL_LABEL ? "all" : tab);
                setInternalThemeTab(THEME_ALL_LABEL);
              }}
              className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (tab === REGION_ALL_LABEL ? "all" : tab) === activeTab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {themeTabs.map((tab) => (
            <button
              key={`theme-${tab}`}
              type="button"
              onClick={() => {
                if (isUrlControlled && onThemeChange) {
                  onThemeChange(tab === THEME_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalThemeTab(tab);
              }}
              className={`min-h-[28px] rounded-full px-2.5 py-1 text-xs font-semibold transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-sm ${
                activeThemeTab === tab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-5">
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
              "표시할 상품이 없습니다. 지역·테마 칩을 바꿔 보세요."
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
