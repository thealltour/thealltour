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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--surface)] p-2 ring-1 ring-[var(--border)]">
          {categoryTabs.map((tab) => {
            const isActive = (tab === "전체" ? "all" : tab) === activeTab;
            return (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={isActive ? "primary" : "secondary"}
                onClick={() => {
                  setActiveTab(tab === "전체" ? "all" : tab);
                  setActiveThemeTab("전체");
                }}
                className="rounded-full px-3 py-1.5 text-xs"
              >
                {tab}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => scrollByCard("left")}
            className="rounded-full px-3 py-1.5 text-sm"
            aria-label="이전 추천상품"
          >
            ←
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => scrollByCard("right")}
            className="rounded-full px-3 py-1.5 text-sm"
            aria-label="다음 추천상품"
          >
            →
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {themeTabs.map((tab) => {
          const isActive = activeThemeTab === tab;
          return (
            <Button
              key={`theme-${tab}`}
              type="button"
              size="sm"
              variant={isActive ? "primary" : "secondary"}
              onClick={() => setActiveThemeTab(tab)}
              className="rounded-full px-3 py-1 text-xs"
            >
              {tab}
            </Button>
          );
        })}
      </div>

      <div
        key={`${activeTab}-${activeThemeTab}`}
        ref={sliderRef}
        className="fade-in-up flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 scroll-smooth [scrollbar-width:thin] [touch-action:pan-x_pan-y]"
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
                className="w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft-strong)] hover:border-[var(--border-strong)] md:w-[330px]"
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
                        {product.category ? (
                          <Badge variant="blue" className="px-3 py-1 text-xs">
                            {product.category}
                          </Badge>
                        ) : null}
                        {badges.map((badge) => (
                          <Badge
                            key={`${product.id}-${badge}`}
                            variant="gold"
                            className="px-2.5 py-1 text-[11px]"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                      <h4 className="font-card-title text-base font-semibold text-content-primary md:text-lg">
                        {product.title}
                      </h4>
                      <p className="line-clamp-2 type-small leading-6 text-content-secondary">
                        {product.description}
                      </p>
                    </div>
                    {typeof product.price === "number" ? (
                      <p className="font-price-strong type-body font-bold text-[var(--primary)]">
                        {new Intl.NumberFormat("ko-KR").format(product.price)}원
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="mt-auto rounded-lg px-4 py-2 text-sm"
                    >
                      상세 보기
                    </Button>
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
