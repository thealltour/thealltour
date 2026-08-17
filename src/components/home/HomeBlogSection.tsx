"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeBlogCard } from "@/components/home/HomeBlogCard";
import type { RssPost } from "@/lib/rss.types";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** 카드 폭(sm 기준 260px) + gap(12px)에 맞춘 스크롤 스텝 */
const SCROLL_AMOUNT = 280;

export type HomeBlogSectionProps = {
  posts: RssPost[];
  className?: string;
};

/**
 * 홈 블로그 섹션. 네이버/티스토리 RSS 최신 글 + 카드.
 * 지역·테마 섹션과 동일하게 가로 스크롤 레이아웃.
 */
export function HomeBlogSection({ posts, className }: HomeBlogSectionProps) {
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
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  if (posts.length === 0) return null;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-2 sm:space-y-4 !px-4 !py-1.5 sm:!px-6 sm:!py-3 md:!px-8 md:!py-4", className)}
    >
      <SectionHeader
        title="여행 스토리 & 블로그"
        description="공식 블로그에서 전해 드리는 생생한 여행 소식과 추천 코스입니다."
        action={
          <Link
            href="/blog"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="블로그 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
        align="left"
      />
      <div className="relative group/scroll">
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
        <ul
          ref={scrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          aria-label="여행 블로그"
        >
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex w-[58%] max-w-[300px] shrink-0 self-stretch sm:w-[260px] sm:max-w-none md:w-[272px]"
            >
              <HomeBlogCard post={post} className="w-full min-w-0" />
            </li>
          ))}
        </ul>
      </div>
    </SectionBlock>
  );
}
