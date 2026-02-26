"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import {
  getProductBadges,
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
}: ProductCatalogSectionProps) {
  const [activeTab, setActiveTab] = useState<ProductCategoryTabId>("all");
  const [activeThemeTab, setActiveThemeTab] = useState("전체");
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

  const filteredProducts = useMemo(
    () => baseProducts.filter((product) => matchesProductTab(product, activeTab)),
    [baseProducts, activeTab],
  );
  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(["전체", ...inferred.slice(1)]));
  }, [baseProducts, activeTab]);
  const themeFilteredProducts = useMemo(
    () => filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab)),
    [filteredProducts, activeThemeTab],
  );
  const keywordFilteredProducts = useMemo(
    () => themeFilteredProducts.filter((product) => matchesKeyword(product, keyword)),
    [themeFilteredProducts, keyword],
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

  return (
    <section className="space-y-5">
      <div className="sticky top-[76px] z-20 space-y-3 rounded-2xl bg-white/95 p-3 shadow-sm ring-1 ring-[#dbeafe] backdrop-blur">
        <p className="text-xs font-semibold text-slate-500">
          총 {keywordFilteredProducts.length}건 · 현재 카테고리 {activeTab === "all" ? "전체" : activeTab}
        </p>
        {presetLabel ? <p className="text-xs font-semibold text-[#15803d]">필터: {presetLabel}</p> : null}
        {keyword ? (
          <p className="text-xs font-semibold text-[#1d4ed8]">검색어: {initialKeyword}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
        {categoryTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab === "전체" ? "all" : tab);
              setActiveThemeTab("전체");
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              (tab === "전체" ? "all" : tab) === activeTab
                ? "bg-[#2563eb] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
            onClick={() => setActiveThemeTab(tab)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeThemeTab === tab
                ? "bg-[#1d4ed8] text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-6">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0] md:col-span-2">
            {keyword ? "검색어와 일치하는 상품이 없습니다." : "선택한 카테고리에 해당하는 상품이 없습니다."}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="text-lg font-bold text-[#1e3a8a]">{group.theme}</h3>
              <div className="grid gap-6 md:grid-cols-2">
                {group.products.map((product) => {
                  const badges = getProductBadges(product);
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="h-full overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe] transition hover:-translate-y-1 hover:shadow-xl"
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
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-block rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                                {product.category}
                              </span>
                              {badges.map((badge) => (
                                <span
                                  key={`${product.id}-${badge}`}
                                  className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                            <h2 className="text-xl font-semibold text-[#0f172a]">{product.title}</h2>
                            <p className="line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p>
                          </div>
                          {typeof product.price === "number" ? (
                            <p className="text-base font-bold text-[#1d4ed8]">
                              {new Intl.NumberFormat("ko-KR").format(product.price)}원
                            </p>
                          ) : null}
                          <span className="mt-auto inline-flex w-fit rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white">
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
