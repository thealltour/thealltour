"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types/product";
import { cn } from "@/lib/cn";
import { HomeProductCard } from "@/components/products/HomeProductCard";

const SCROLL_AMOUNT = 320;

const RAIL_ITEM_CLASS = "h-full min-h-0 snap-start";

const RAIL_UL_CLASS_DEFAULT =
  "grid grid-flow-col auto-cols-[min(82%,320px)] gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 sm:auto-cols-[280px] lg:auto-cols-[calc((min(100%,1344px)-3*1rem)/4)] [touch-action:pan-x_pan-y]";

const RAIL_UL_CLASS_COMPACT =
  "grid grid-flow-col auto-cols-[min(82%,320px)] gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 [touch-action:pan-x_pan-y]";

export type HomeProductCardRailProps = {
  products: Product[];
  /** 홈 큐레이션 카드 클릭 계측 section */
  analyticsSection?: string;
  listAriaLabel?: string;
  className?: string;
  priceDisplay?: "default" | "coinBenefit";
  /** compact: 하드코딩 랜딩 등 좁은 좌우 inset */
  edgeInset?: "default" | "compact";
};

/**
 * 홈 상품 카드 1행 가로 레일 — 지역/테마 ExploreTaxonomyList home 패턴과 동일 UX.
 */
export function HomeProductCardRail({
  products,
  analyticsSection,
  listAriaLabel = "추천 상품",
  className,
  priceDisplay = "default",
  edgeInset = "default",
}: HomeProductCardRailProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, products.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  const railUlClass = edgeInset === "compact" ? RAIL_UL_CLASS_COMPACT : RAIL_UL_CLASS_DEFAULT;

  return (
    <div className={cn("relative mx-auto w-full max-w-[1344px] group/scroll", className)}>
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="왼쪽으로 스크롤"
          className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-hover)] hover:opacity-100 sm:h-12 sm:w-12 sm:translate-x-0"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="오른쪽으로 스크롤"
          className="absolute right-0 top-1/2 z-10 flex h-10 w-10 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-hover)] hover:opacity-100 sm:h-12 sm:w-12 sm:translate-x-0"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </button>
      ) : null}
      <ul ref={scrollRef} className={railUlClass} aria-label={listAriaLabel}>
        {products.map((product) => (
          <li key={product.id} className={RAIL_ITEM_CLASS}>
            <HomeProductCard
              product={product}
              variant="rail"
              className="h-full min-h-0 w-full"
              analyticsSection={analyticsSection}
              priceDisplay={priceDisplay}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
