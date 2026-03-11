"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import {
  getDestinationLandingHref,
  getThemeLandingHref,
  getProductLineLandingHref,
} from "@/lib/hubLandingLinks";
import {
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING_HOME,
  CARD_IMAGE_ASPECT_HOME,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SCROLL_AMOUNT = 320;

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-home/800/500";

export type HomeTaxonomyGridLayout = "grid" | "horizontal-scroll";

export type HomeTaxonomyGridProps = {
  items: ProductTaxonomy[];
  type: "destination" | "theme" | "product_line";
  className?: string;
  /** grid: 2열(모바일)~4열. horizontal-scroll: 가로 스크롤 카드 (지역 섹션용) */
  layout?: HomeTaxonomyGridLayout;
};

function getHref(item: ProductTaxonomy, type: HomeTaxonomyGridProps["type"]): string {
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
 * 홈용 taxonomy 탐색 카드 그리드.
 * 모바일: 이미지 16:9, 텍스트 이미지 아래, 설명 1줄.
 * 지역: 가로 스크롤 / 테마: 2열 그리드 (layout으로 분기).
 */
export function HomeTaxonomyGrid({
  items,
  type,
  className,
  layout = "grid",
}: HomeTaxonomyGridProps) {
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
    if (!el || layout !== "horizontal-scroll") return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [layout, updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const isHorizontalScroll = layout === "horizontal-scroll";

  const listContent = (
    <ul
      ref={isHorizontalScroll ? scrollRef : undefined}
      className={cn(
        isHorizontalScroll
          ? "flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0"
          : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        !isHorizontalScroll && className,
      )}
      aria-label={type === "destination" ? "지역별 탐색" : type === "theme" ? "테마별 탐색" : "상품군별 탐색"}
    >
      {items.map((item) => {
        const href = getHref(item, type);
        const title = item.card_title?.trim() || item.name;
        const description = item.card_description?.trim() || null;
        const imageUrl = item.card_image_url?.trim() || null;

        return (
          <li
            key={item.id}
            className={cn(
              isHorizontalScroll && "min-w-[72%] sm:min-w-[260px] shrink-0",
            )}
          >
            <Link
              href={href}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-2xl",
                CARD_HOVER,
                CARD_TRANSITION,
              )}
            >
              <div className={cn("relative w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]", CARD_IMAGE_ASPECT_HOME)}>
                <Image
                  src={imageUrl || FALLBACK_IMAGE}
                  alt=""
                  fill
                  sizes={isHorizontalScroll ? "(max-width: 640px) 72vw, 260px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
                  className="object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              </div>
              <div className={cn("flex flex-1 flex-col", CARD_PADDING_HOME)}>
                <h3 className="font-card-title text-sm font-semibold leading-tight text-[var(--foreground)]">
                  {title}
                </h3>
                {description ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)] md:type-caption">
                    {description}
                  </p>
                ) : null}
                <span className="mt-2 inline-flex items-center text-xs font-medium text-[var(--primary)] sm:mt-3 md:section-label">
                  자세히 보기
                  <span className="ml-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (isHorizontalScroll) {
    return (
      <div className={cn("relative group/scroll", className)}>
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="왼쪽으로 스크롤"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 -translate-x-1 sm:translate-x-0"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="오른쪽으로 스크롤"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 translate-x-1 sm:translate-x-0"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        {listContent}
      </div>
    );
  }

  return listContent;
}
