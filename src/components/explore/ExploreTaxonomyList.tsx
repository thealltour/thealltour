"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import {
  getDestinationLandingHref,
  getThemeLandingHref,
  getProductLineLandingHref,
} from "@/lib/hubLandingLinks";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExploreCategoryCard } from "@/components/explore/ExploreCategoryCard";

const SCROLL_AMOUNT = 320;

export type ExploreTaxonomyType = "destination" | "theme" | "product_line";

export type ExploreTaxonomyListProps = {
  items: ProductTaxonomy[];
  taxonomyType: ExploreTaxonomyType;
  /** home: 항상 가로 레일(+sm 이상 쉐브론). hub: md 미만 레일, md+ 그리드 */
  layoutPreset: "home" | "hub";
  listAriaLabel: string;
  className?: string;
};

function getHref(item: ProductTaxonomy, type: ExploreTaxonomyType): string {
  switch (type) {
    case "destination":
      return getDestinationLandingHref(item);
    case "theme":
      return getThemeLandingHref(item);
    case "product_line":
      return getProductLineLandingHref(item);
    default:
      return "/products";
  }
}

/**
 * 홈·허브 공통: taxonomy 카드 가로 레일(scroll-snap) 및 허브용 md+ 그리드.
 */
export function ExploreTaxonomyList({
  items,
  taxonomyType,
  layoutPreset,
  listAriaLabel,
  className,
}: ExploreTaxonomyListProps) {
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
  }, [updateScrollState, items.length, layoutPreset]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  };

  if (items.length === 0) return null;

  const railItemClass = "min-w-[58%] shrink-0 snap-start sm:min-w-[240px]";

  const railUlClass =
    layoutPreset === "home"
      ? "flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 [touch-action:pan-x]"
      : "flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 [touch-action:pan-x] md:hidden";

  const gridUlClass =
    "hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const sizesRail = "(max-width: 640px) 58vw, 240px";
  const sizesGrid = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

  const renderCard = (item: ProductTaxonomy, sizes: string) => {
    const href = getHref(item, taxonomyType);
    const title = item.card_title?.trim() || item.name;
    const subtitle = item.card_description?.trim() || null;
    const imageSrc = item.card_image_url?.trim() || "";

    return (
      <ExploreCategoryCard
        href={href}
        title={title}
        subtitle={subtitle}
        imageSrc={imageSrc}
        imageSizes={sizes}
      />
    );
  };

  const railList = (
    <ul ref={scrollRef} className={railUlClass} aria-label={listAriaLabel}>
      {items.map((item) => (
        <li key={item.id} className={railItemClass}>
          {renderCard(item, sizesRail)}
        </li>
      ))}
    </ul>
  );

  const gridList =
    layoutPreset === "hub" ? (
      <ul className={cn(gridUlClass, className)} aria-label={listAriaLabel}>
        {items.map((item) => (
          <li key={item.id}>{renderCard(item, sizesGrid)}</li>
        ))}
      </ul>
    ) : null;

  const chevrons = (
    <>
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
    </>
  );

  if (layoutPreset === "home") {
    return (
      <div className={cn("relative group/scroll", className)}>
        {chevrons}
        {railList}
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <div className="relative md:hidden">
        {chevrons}
        {railList}
      </div>
      {gridList}
    </div>
  );
}
