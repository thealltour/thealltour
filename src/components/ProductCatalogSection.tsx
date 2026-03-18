"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/ConsultModal";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";

type ProductCatalogSectionProps = {
  products: Product[];
  categories: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  /** URL 필터 연동 시: 초기 지역(카테고리) */
  initialRegion?: string | null;
  /** URL 필터 연동 시: 초기 테마 */
  initialTheme?: string | null;
  /** URL 필터 연동 시: 카테고리 탭 클릭 시 호출 */
  onCategoryChange?: (region: string | null) => void;
  /** URL 필터 연동 시: 테마 탭 클릭 시 호출 */
  onThemeChange?: (theme: string | null) => void;
  /** 0건일 때 필터 초기화(전체 상품 보기)용. 제공 시 빈 결과 UI에 "필터 초기화" CTA 노출 */
  onResetFilters?: () => void;
  /** list: /products 본문용 비교 카드. related: 랜딩 하단용 간결 카드(이미지·가격 중심) */
  cardLayout?: "list" | "related";
};

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

function matchesKeyword(product: Product, keyword: string) {
  if (!keyword) {
    return true;
  }

  const haystack = [product.title, product.description, product.category, product.theme ?? ""]
    .join(" ")
    .toLowerCase();

  const tokens = keyword
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => haystack.includes(token));
}

export default function ProductCatalogSection({
  products,
  categories,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  initialRegion,
  initialTheme,
  onCategoryChange,
  onThemeChange,
  onResetFilters,
  cardLayout = "list",
}: ProductCatalogSectionProps) {
  const [internalTab, setInternalTab] = useState<ProductCategoryTabId>("all");
  const [internalThemeTab, setInternalThemeTab] = useState("전체");

  const isUrlControlled = onCategoryChange != null && onThemeChange != null;
  const activeTab: ProductCategoryTabId = isUrlControlled
    ? (initialRegion ?? "all")
    : internalTab;
  const activeThemeTab = isUrlControlled
    ? (initialTheme ?? "전체")
    : internalThemeTab;

  useEffect(() => {
    if (!isUrlControlled) return;
    setInternalTab(initialRegion ?? "all");
    setInternalThemeTab(initialTheme ?? "전체");
  }, [isUrlControlled, initialRegion, initialTheme]);

  const keyword = useMemo(() => normalizeSearchKeyword(initialKeyword), [initialKeyword]);
  const presetCategorySet = useMemo(
    () => new Set((presetCategories ?? []).map((item) => item.trim()).filter(Boolean)),
    [presetCategories],
  );
  const baseProducts = useMemo(
    () =>
      presetCategorySet.size > 0
        ? products.filter((product) => presetCategorySet.has(product.category))
        : products,
    [products, presetCategorySet],
  );
  const visibleCategories = useMemo(
    () => (presetCategorySet.size > 0 ? categories.filter((category) => presetCategorySet.has(category)) : categories),
    [categories, presetCategorySet],
  );
  const categoryTabs = useMemo(() => ["전체", ...visibleCategories], [visibleCategories]);
  /** URL 연동 시 부모가 이미 region/theme 필터 적용함 → 키워드만 적용 */
  const filteredProducts = useMemo(() => {
    if (isUrlControlled) return baseProducts;
    return baseProducts.filter((product) => matchesProductTab(product, activeTab));
  }, [baseProducts, activeTab, isUrlControlled]);
  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(["전체", ...inferred.slice(1)]));
  }, [baseProducts, activeTab]);
  const themeFilteredProducts = useMemo(() => {
    if (isUrlControlled) return filteredProducts;
    return filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab));
  }, [filteredProducts, activeThemeTab, isUrlControlled]);
  const keywordFilteredProducts = useMemo(
    () =>
      (isUrlControlled ? filteredProducts : themeFilteredProducts).filter((product) =>
        matchesKeyword(product, keyword),
      ),
    [isUrlControlled, filteredProducts, themeFilteredProducts, keyword],
  );
  const groupedByTheme = useMemo(
    () => groupProductsByTheme(keywordFilteredProducts, themeTabs),
    [keywordFilteredProducts, themeTabs],
  );
  const displayGroups = useMemo(
    () =>
      groupedByTheme.length > 0
        ? groupedByTheme
        : keywordFilteredProducts.length > 0
          ? [{ theme: "기타", products: keywordFilteredProducts }]
          : [],
    [groupedByTheme, keywordFilteredProducts],
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();

  function handleProductConsult(product: Product) {
    const query = searchParams.toString();
    openModal({
      productId: product.id,
      productTitle: product.title,
      sourcePath: query ? `${pathname}?${query}` : pathname,
    });
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-[76px] z-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {keywordFilteredProducts.length}건 · 현재 카테고리 {activeTab === "all" ? "전체" : activeTab}
          </p>
          {presetLabel ? <p className="text-xs leading-snug text-[#15803d] sm:text-sm">필터: {presetLabel}</p> : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">검색어: {initialKeyword}</p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {categoryTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (isUrlControlled && onCategoryChange) {
                onCategoryChange(tab === "전체" ? null : tab);
                return;
              }
              setInternalTab(tab === "전체" ? "all" : tab);
              setInternalThemeTab("전체");
            }}
            className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
              (tab === "전체" ? "all" : tab) === activeTab
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
                onThemeChange(tab === "전체" ? null : tab);
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
            {(initialRegion || initialTheme || (initialKeyword && initialKeyword.trim())) && onResetFilters ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">선택한 조건에 맞는 상품이 없습니다.</p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {[initialRegion && `지역: ${initialRegion}`, initialTheme && `테마: ${initialTheme}`, initialKeyword?.trim() && `키워드: ${initialKeyword.trim()}`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90"
                  >
                    전체 상품 보기
                  </Link>
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    필터 초기화
                  </button>
                </div>
              </>
            ) : keyword ? (
              "검색어와 일치하는 상품이 없습니다."
            ) : (
              "선택한 카테고리에 해당하는 상품이 없습니다."
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
                    const cardProps = productToProductCardProps(product, {
                      analyticsSource: "product_list",
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                    });

                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard {...cardProps} />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile {...cardProps} />
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
