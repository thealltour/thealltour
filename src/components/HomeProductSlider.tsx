"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import {
  getProductBadges,
  getThemeTabs,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";

type HomeProductSliderProps = {
  products: Product[];
  categories: string[];
};

export default function HomeProductSlider({ products, categories }: HomeProductSliderProps) {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<ProductCategoryTabId>("all");
  const [activeThemeTab, setActiveThemeTab] = useState("전체");

  const categoryTabs = useMemo(() => ["전체", ...categories], [categories]);
  const filteredProducts = useMemo(
    () => products.filter((product) => matchesProductTab(product, activeTab)),
    [products, activeTab],
  );
  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(products, activeTab);
    return Array.from(new Set(["전체", ...inferred.slice(1)]));
  }, [products, activeTab]);
  const themeFilteredProducts = useMemo(
    () => filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab)),
    [filteredProducts, activeThemeTab],
  );

  function scrollByCard(direction: "left" | "right") {
    const element = sliderRef.current;
    if (!element) return;
    const distance = Math.max(280, Math.floor(element.clientWidth * 0.8));
    element.scrollBy({
      left: direction === "right" ? distance : -distance,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (themeFilteredProducts.length <= 1) return;
    const timer = setInterval(() => {
      const element = sliderRef.current;
      if (!element || pausedRef.current) return;

      const nearEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 24;
      if (nearEnd) {
        element.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      const distance = Math.max(280, Math.floor(element.clientWidth * 0.8));
      element.scrollBy({ left: distance, behavior: "smooth" });
    }, 3500);

    return () => clearInterval(timer);
  }, [themeFilteredProducts.length]);

  useEffect(() => {
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [activeTab, activeThemeTab]);

  return (
    <div
      className="space-y-4"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onTouchStart={() => {
        pausedRef.current = true;
      }}
      onTouchEnd={() => {
        pausedRef.current = false;
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-2 ring-1 ring-[#dbeafe]">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab === "전체" ? "all" : tab);
                setActiveThemeTab("전체");
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                (tab === "전체" ? "all" : tab) === activeTab
                  ? "bg-[#2563eb] text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard("left")}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            aria-label="이전 추천상품"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByCard("right")}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            aria-label="다음 추천상품"
          >
            →
          </button>
        </div>
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

      <div
        key={`${activeTab}-${activeThemeTab}`}
        ref={sliderRef}
        className="fade-in-up flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 scroll-smooth [scrollbar-width:thin] [touch-action:pan-x]"
      >
        {themeFilteredProducts.length === 0 ? (
          <div className="w-full rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
            선택한 카테고리에 해당하는 추천 상품이 없습니다.
          </div>
        ) : (
          themeFilteredProducts.map((product) => {
            const badges = getProductBadges(product);
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe] transition hover:-translate-y-1 hover:shadow-xl md:w-[330px]"
              >
                <article className="flex h-full flex-col">
                  <Image
                    src={product.image_url}
                    alt={`${product.title} 상품 이미지`}
                    width={800}
                    height={500}
                    sizes="(max-width: 768px) 280px, 330px"
                    loading="lazy"
                    className="h-48 w-full object-cover md:h-52"
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
                      <h4 className="text-lg font-semibold text-[#0f172a]">{product.title}</h4>
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
          })
        )}
      </div>
    </div>
  );
}
