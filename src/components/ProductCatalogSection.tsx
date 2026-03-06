"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import type { ProductCardTag } from "@/components/ProductCard";
import type { ProductCardV2Status } from "@/components/products/ProductCardV2";
import ProductCard from "@/components/ProductCard";
import ProductCardV2 from "@/components/products/ProductCardV2";
import { useConsultModal } from "@/components/ConsultModal";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import {
  getProductBadges,
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";

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
};

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

function buildV2Badges(product: Product, themeBadges: string[]): { type: string; label: string; priority?: number; isActive?: boolean }[] {
  const badges: { type: string; label: string; priority?: number; isActive?: boolean }[] = [];
  themeBadges.forEach((label) => {
    badges.push({
      type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
      label,
      priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
      isActive: true,
    });
  });
  return badges;
}

function buildProductCardTags(product: Product, themeBadges: string[]): ProductCardTag[] {
  const tags: ProductCardTag[] = [];
  tags.push({ label: product.category, variant: "accent" });
  themeBadges.forEach((label) => {
    tags.push({
      label,
      variant: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    });
  });
  return tags;
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
    const isMobile =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (isMobile) {
      const query = searchParams.toString();
      openModal({
        productId: product.id,
        productTitle: product.title,
        sourcePath: query ? `${pathname}?${query}` : pathname,
      });
      return;
    }
    router.push(`/quote?productId=${encodeURIComponent(product.id)}`);
  }

  return (
    <section className="space-y-5">
      <div className="sticky top-[76px] z-20 space-y-3 rounded-2xl bg-[var(--surface)]/95 p-3 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] backdrop-blur">
        <p className="section-label text-content-muted">
          총 {keywordFilteredProducts.length}건 · 현재 카테고리 {activeTab === "all" ? "전체" : activeTab}
        </p>
        {presetLabel ? <p className="section-label text-[#15803d]">필터: {presetLabel}</p> : null}
        {keyword ? (
          <p className="section-label text-[var(--primary)]">검색어: {initialKeyword}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
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
            className={`type-btn rounded-full px-3.5 py-1.5 transition ${
              (tab === "전체" ? "all" : tab) === activeTab
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className={`type-caption rounded-full px-3 py-1 font-semibold transition ${
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

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-6">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:col-span-2">
            {keyword ? "검색어와 일치하는 상품이 없습니다." : "선택한 카테고리에 해당하는 상품이 없습니다."}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                {group.products.map((product) => {
                  const badges = getProductBadges(product);
                  const hashtags = parseMetaTitleAsHashtags(product.meta_title);
                  const tags = buildProductCardTags(product, badges);
                  const status: ProductCardV2Status = product.status ?? "AVAILABLE";
                  if (ENABLE_NEW_PRODUCT_UI) {
                    return (
                      <ProductCardV2
                        key={product.id}
                        title={product.title}
                        price={product.price}
                        duration={product.duration}
                        region={product.theme}
                        categories={[product.category]}
                        tags={hashtags}
                        status={status}
                        badges={buildV2Badges(product, badges)}
                        thumbnailUrl={product.image_url}
                        priceMeta={product.price_meta || "1인 기준"}
                        metaInfo={product.meta_info ?? ""}
                        hrefDetail={`/products/${product.id}`}
                        onClickDetail={() => router.push(`/products/${product.id}`)}
                        onClickConsult={() => handleProductConsult(product)}
                        analyticsSource="product_list"
                        analyticsSection="catalog"
                        productId={product.id}
                      />
                    );
                  }
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="h-full overflow-hidden rounded-3xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft-strong)]"
                    >
                      <article className="flex h-full flex-col">
                        <Image
                          src={product.image_url}
                          alt={`${product.title} 상품 이미지`}
                          width={900}
                          height={560}
                          sizes="(max-width: 768px) 100vw, 50vw"
                          loading="lazy"
                          className="h-52 w-full object-cover"
                        />
                        <div className="flex flex-1 flex-col gap-3 p-5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-block rounded-full bg-[var(--surface-muted)] px-3 py-1 type-caption font-semibold text-[var(--primary)]">
                              {product.category}
                            </span>
                            {badges.map((badge) => (
                              <span
                                key={`${product.id}-${badge}`}
                                className="inline-block rounded-full bg-amber-50 px-2.5 py-1 type-caption font-semibold text-amber-700 ring-1 ring-amber-200"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                          <h2 className="font-card-title type-body font-semibold text-[var(--text-primary)] md:type-small line-clamp-2">
                            {product.title}
                          </h2>
                          <p className="line-clamp-1 type-small leading-6 text-[var(--text-secondary)]">
                            {product.description}
                          </p>
                          {typeof product.price === "number" ? (
                            <p className="font-price-strong type-body font-bold text-[var(--primary)]">
                              {new Intl.NumberFormat("ko-KR").format(product.price)}원~
                            </p>
                          ) : null}
                          {hashtags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {hashtags.map((tag) => (
                                <span
                                  key={`${product.id}-${tag}`}
                                  className="type-caption text-[var(--text-muted)]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <span className="type-btn mt-auto inline-flex w-fit rounded-lg bg-[var(--primary)] px-4 py-2 text-white">
                            상세 보기
                          </span>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
