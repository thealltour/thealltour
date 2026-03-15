"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type {
  TimelineModel,
  TimelineDay,
  TimelineEvent,
} from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buildDaySummary } from "@/lib/products/buildDaySummary";
import {
  trackProductItineraryDayClick,
  trackProductItineraryImageOpen,
} from "@/lib/analytics/trackProductClick";
import type { ProductDetailStatusTag } from "@/lib/products/productDetailCta";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
import { TimelineEventCard } from "@/components/products/timeline/TimelineEventCard";
type TimelineEventRowDesktopProps = {
  ev: TimelineEvent;
  i: number;
  dayIndex: number;
  isSelected: boolean;
  selectedCardRef: React.RefObject<HTMLDivElement | null>;
  onEventSelect: ((dayIndex: number, eventIndex: number) => void) | undefined;
  onImageOpen: (idx: number) => void;
  normalizeUrl: (url: string) => string;
  productId: string | undefined;
};

function TimelineEventRowDesktop({
  ev,
  i,
  dayIndex,
  isSelected,
  selectedCardRef,
  onEventSelect,
  onImageOpen,
  normalizeUrl,
  productId,
}: TimelineEventRowDesktopProps) {
  return (
    <div
      ref={isSelected ? selectedCardRef : undefined}
      className="flex items-start gap-4"
    >
      <div className="flex w-6 shrink-0 justify-center pt-5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]/60 ring-2 ring-[var(--surface)]" aria-hidden />
      </div>
      <div
        className={`min-w-0 flex-1 rounded-2xl transition ${
          isSelected
            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
            : ""
        } ${onEventSelect ? "cursor-pointer" : ""}`}
        role={onEventSelect ? "button" : undefined}
        tabIndex={onEventSelect ? 0 : undefined}
        onClick={onEventSelect ? () => onEventSelect(dayIndex, i) : undefined}
        onKeyDown={
          onEventSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventSelect(dayIndex, i);
                }
              }
            : undefined
        }
      >
        <TimelineEventCard
          event={ev}
          normalizeUrl={normalizeUrl}
          productId={productId}
          dayIndex={dayIndex}
          eventIndex={i}
          onImageOpen={onImageOpen}
        />
      </div>
    </div>
  );
}

type TimelineEventRowMobileProps = TimelineEventRowDesktopProps;

function TimelineEventRowMobile(props: TimelineEventRowMobileProps) {
  const { ev, i, dayIndex, isSelected, selectedCardRef, onEventSelect, onImageOpen, normalizeUrl, productId } = props;
  return (
    <div
      ref={isSelected ? selectedCardRef : undefined}
      className="flex items-start gap-3"
    >
      <span className="mt-5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]/50" aria-hidden />
      <div
        className={`min-w-0 flex-1 rounded-2xl transition ${
          isSelected ? "ring-2 ring-[var(--primary)]" : ""
        } ${onEventSelect ? "cursor-pointer" : ""}`}
        role={onEventSelect ? "button" : undefined}
        tabIndex={onEventSelect ? 0 : undefined}
        onClick={onEventSelect ? () => onEventSelect(dayIndex, i) : undefined}
        onKeyDown={
          onEventSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventSelect(dayIndex, i);
                }
              }
            : undefined
        }
      >
        <TimelineEventCard
          event={ev}
          normalizeUrl={normalizeUrl}
          productId={productId}
          dayIndex={dayIndex}
          eventIndex={i}
          onImageOpen={onImageOpen}
        />
      </div>
    </div>
  );
}

export type InteractiveTimelineV2Props = {
  model: TimelineModel;
  fallbackImageUrl?: string | null;
  onDayChange?: (day: number) => void;
  maxEventsVisible?: number;
  selectedDayIndex?: number;
  selectedEventIndex?: number;
  onEventSelect?: (dayIndex: number, eventIndex: number) => void;
  /** PR20: 일정 하단 CTA 및 analytics */
  productId?: string;
  status?: ProductDetailStatusTag;
  productTitle?: string;
  sourcePath?: string;
  kakaoHref?: string;
};

function CoverImage({
  day,
  fallbackImageUrl,
}: {
  day: TimelineDay;
  fallbackImageUrl: string | null;
}) {
  const raw = day.imageUrl?.trim() || fallbackImageUrl?.trim() || "";
  const src = raw ? normalizeProductImageUrl(raw) : "";

  if (src) {
    return (
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] shadow-lg">
        <Image
          src={src}
          alt={day.dateText ? `Day ${day.day} - ${day.dateText}` : `Day ${day.day}`}
          fill
          sizes="(max-width: 768px) 100vw, 900px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-[21/9] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]"
      aria-hidden
    >
      <ImageIcon className="h-12 w-12 opacity-50" />
      <span className="text-sm font-medium">Day {day.day} 일정 이미지 없음</span>
    </div>
  );
}

export function InteractiveTimelineV2({
  model,
  fallbackImageUrl = null,
  onDayChange,
  maxEventsVisible,
  selectedDayIndex,
  selectedEventIndex,
  onEventSelect,
  productId,
  status,
  productTitle,
  sourcePath,
  kakaoHref,
}: InteractiveTimelineV2Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  if (!model?.days?.length) return null;

  const days = model.days;
  const fallback = fallbackImageUrl?.trim() ?? "";
  const activeDay = days[activeIndex] ?? days[0];

  // PR15-1 Step2: 미리보기 Day 클릭 시 activeIndex 동기화 + 상세 일정 상단으로 스크롤
  useEffect(() => {
    if (selectedDayIndex == null) return;
    if (selectedDayIndex < 0 || selectedDayIndex >= days.length) return;
    setActiveIndex(selectedDayIndex);
    requestAnimationFrame(() => {
      topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedDayIndex, days.length]);

  // 선택된 이벤트 카드로 스크롤 (이벤트 선택 시)
  useEffect(() => {
    if (
      selectedDayIndex == null ||
      selectedEventIndex == null ||
      selectedDayIndex !== activeIndex
    )
      return;
    const t = setTimeout(() => {
      selectedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
    return () => clearTimeout(t);
  }, [selectedDayIndex, selectedEventIndex, activeIndex]);

  const handleDayTab = (index: number, scrollToSection = false, source: "sticky_nav" | "tabs" = "tabs") => {
    setActiveIndex(index);
    const day = days[index];
    if (day) onDayChange?.(day.day);
    if (productId) {
      trackProductItineraryDayClick({
        productId,
        dayIndex: index,
        dayLabel: `Day ${day?.day ?? index + 1}`,
        source,
      });
    }
    if (scrollToSection) {
      requestAnimationFrame(() => {
        topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const toggleExpand = (dayNum: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNum)) next.delete(dayNum);
      else next.add(dayNum);
      return next;
    });
  };

  // PR15-1: activeDay 기준 본문 파생값 (단일 Day 렌더용)
  const day = activeDay;
  const dayIndex = activeIndex;
  const isExpanded = expandedDays.has(day.day);
  const displayEvents =
    maxEventsVisible != null && day.events.length > maxEventsVisible && !isExpanded
      ? day.events.slice(0, maxEventsVisible)
      : day.events;
  const hasMore =
    maxEventsVisible != null && day.events.length > maxEventsVisible && !isExpanded;
  const moreCount = hasMore ? day.events.length - maxEventsVisible! : 0;
  const titleLine = day.dateText ? `Day ${day.day} - ${day.dateText}` : `Day ${day.day}`;
  const daySummaryItems = buildDaySummary(day.events);

  return (
    <section
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
      aria-label="일정 안내"
    >
      <div className="p-4 sm:p-6">
        <div ref={topAnchorRef} />
        {/* PR13-1: Sticky Day 탭 — overflow 조상 제거로 실제 sticky 동작, 하단 여백 축소 */}
        <div className="sticky top-16 z-20 -mx-4 -mt-4 mb-4 flex border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-[var(--surface)]/90 sm:-mx-6 sm:-mt-6 sm:px-6 md:top-20">
          <div className="scrollbar-hide flex w-full flex-nowrap gap-2 overflow-x-auto pb-px">
            {days.map((d, i) => (
              <button
                key={`day-nav-${d.day}-${i}`}
                type="button"
                onClick={() => handleDayTab(i, true, "sticky_nav")}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeIndex === i
                    ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md ring-2 ring-[var(--primary)]/20"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text-primary)]"
                }`}
                aria-current={activeIndex === i ? "true" : undefined}
              >
                Day {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* PR15-1: activeDay 단일 섹션 렌더 (선택된 Day 1개만 본문 표시) */}
        <section
          key={`day-${day.day}`}
          id={`itinerary-day-${day.day}`}
          className="scroll-mt-24 pb-10 md:scroll-mt-28"
          aria-label={titleLine}
        >
          <div className="mb-6 space-y-4">
            <CoverImage day={day} fallbackImageUrl={fallback} />
            <div className="text-center">
              <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                {titleLine}
              </h3>
              {day.title && (
                <p className="mt-1 text-sm font-medium text-[var(--text-secondary)] sm:text-base">
                  {day.title}
                </p>
              )}
              {daySummaryItems.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {daySummaryItems.map((item, idx) => (
                    <span
                      key={`${item}-${idx}`}
                      className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {day.events.length >= 1 ? (
            <div className="relative">
              <div className="hidden md:block">
                <div className="absolute left-0 top-0 bottom-0 w-6" aria-hidden>
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--primary)]/25" />
                </div>
                <div className="flex flex-col space-y-6">
                  {displayEvents.map((ev, i) => {
                    const isSelected =
                      onEventSelect != null &&
                      selectedDayIndex === dayIndex &&
                      selectedEventIndex === i;
                    const handleImageOpen = (idx: number) => {
                      if (productId) {
                        trackProductItineraryImageOpen({
                          productId,
                          dayIndex,
                          eventIndex: i,
                          imageIndex: idx,
                        });
                      }
                    };
                    return (
                      <TimelineEventRowDesktop
                        key={`${ev.heading}-${i}`}
                        ev={ev}
                        i={i}
                        dayIndex={dayIndex}
                        isSelected={isSelected}
                        selectedCardRef={selectedCardRef}
                        onEventSelect={onEventSelect}
                        onImageOpen={handleImageOpen}
                        normalizeUrl={normalizeProductImageUrl}
                        productId={productId}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="space-y-5 md:hidden" aria-label="모바일 일정">
                {displayEvents.map((ev, i) => {
                  const isSelected =
                    onEventSelect != null &&
                    selectedDayIndex === dayIndex &&
                    selectedEventIndex === i;
                  const handleImageOpenMobile = (idx: number) => {
                    if (productId) {
                      trackProductItineraryImageOpen({
                        productId,
                        dayIndex,
                        eventIndex: i,
                        imageIndex: idx,
                      });
                    }
                  };
                  return (
                    <TimelineEventRowMobile
                      key={`${ev.heading}-${i}`}
                      ev={ev}
                      i={i}
                      dayIndex={dayIndex}
                      isSelected={isSelected}
                      selectedCardRef={selectedCardRef}
                      onEventSelect={onEventSelect}
                      onImageOpen={handleImageOpenMobile}
                      normalizeUrl={normalizeProductImageUrl}
                      productId={productId}
                    />
                  );
                })}
              </div>
              {maxEventsVisible != null && day.events.length > maxEventsVisible && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => toggleExpand(day.day)}
                    className="rounded-lg border border-[var(--primary)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--primary)] shadow-sm transition hover:bg-[var(--primary-soft)]"
                  >
                    {isExpanded ? "접기" : `더 보기 (${moreCount}건)`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">이 일차에 등록된 일정이 없습니다.</p>
          )}
        </section>

        {/* PR13-1: 하단 보조 Day 네비게이션 — 긴 일정 읽은 뒤 다른 Day로 이동용 */}
        {days.length > 1 && (
          <div className="mt-8 border-t border-[var(--border)] pt-5">
            <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">다른 일자 보기</p>
            <div className="scrollbar-hide flex flex-nowrap gap-2 overflow-x-auto pb-1">
              {days.map((d, i) => (
                <button
                  key={`day-bottom-${d.day}-${i}`}
                  type="button"
                  onClick={() => handleDayTab(i, true, "tabs")}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeIndex === i
                      ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text-primary)]"
                  }`}
                  aria-current={activeIndex === i ? "true" : undefined}
                >
                  Day {d.day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 일정 하단 CTA: 통합 ProductConsultCTA */}
        {productId && productTitle != null && (
          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm">
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle}
              sourcePath={sourcePath ?? ""}
              status={status}
              kakaoHref={kakaoHref}
              section="itinerary"
              copy="이 일정이 마음에 드시나요?"
              subCopy="출발 가능 여부·맞춤 견적은 상담 후 안내해 드립니다."
            />
          </div>
        )}
      </div>
    </section>
  );
}
