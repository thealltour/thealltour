"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type {
  TimelineModel,
  TimelineDay,
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
  const activeDay = days[activeIndex] ?? days[0];
  const fallback = fallbackImageUrl?.trim() ?? "";

  // 선택된 이벤트가 있으면 해당 Day 탭으로 맞춤
  useEffect(() => {
    if (selectedDayIndex != null && selectedDayIndex >= 0 && selectedDayIndex < days.length) {
      setActiveIndex(selectedDayIndex);
    }
  }, [selectedDayIndex, days.length]);

  // 선택된 이벤트 카드로 스크롤
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

  const isExpanded = expandedDays.has(activeDay.day);
  const displayEvents =
    maxEventsVisible != null && activeDay.events.length > maxEventsVisible && !isExpanded
      ? activeDay.events.slice(0, maxEventsVisible)
      : activeDay.events;
  const hasMore =
    maxEventsVisible != null && activeDay.events.length > maxEventsVisible && !isExpanded;
  const moreCount = hasMore ? activeDay.events.length - maxEventsVisible! : 0;

  const handleDayTab = (index: number, scrollToTop = false, source: "sticky_nav" | "tabs" = "tabs") => {
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
    if (scrollToTop) {
      requestAnimationFrame(() => {
        topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const toggleExpand = () => {
    if (isExpanded) {
      setExpandedDays((prev) => {
        const next = new Set(prev);
        next.delete(activeDay.day);
        return next;
      });
    } else {
      setExpandedDays((prev) => new Set(prev).add(activeDay.day));
    }
  };

  const showMoreButton =
    maxEventsVisible != null && activeDay.events.length > maxEventsVisible ? (
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={toggleExpand}
          className="rounded-lg border border-[var(--primary)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--primary)] shadow-sm transition hover:bg-[var(--primary-soft)]"
        >
          {isExpanded ? "접기" : `더 보기 (${moreCount}건)`}
        </button>
      </div>
    ) : null;

  const titleLine = activeDay.dateText
    ? `Day ${activeDay.day} - ${activeDay.dateText}`
    : `Day ${activeDay.day}`;

  const daySummaryItems = buildDaySummary(activeDay.events);

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
      aria-label="일정 안내"
    >
      <div className="p-4 sm:p-6">
        <div ref={topAnchorRef} />
        {/* Sticky Day Navigation: 헤더 아래 고정, 모바일 가로 스크롤 */}
        <div className="sticky top-16 z-10 -mx-4 -mt-4 mb-6 flex border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm sm:-mx-6 sm:-mt-6 sm:px-6 md:top-20">
          <div className="scrollbar-hide flex w-full gap-2 overflow-x-auto">
            {days.map((d, i) => (
              <button
                key={`day-nav-${d.day}-${i}`}
                type="button"
                onClick={() => handleDayTab(i, true, "sticky_nav")}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeIndex === i
                    ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                    : "bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]/80"
                }`}
                aria-current={activeIndex === i ? "true" : undefined}
              >
                Day {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* Day 대표 이미지 + 제목 + Day Summary (2~4 키워드) */}
        <div className="mb-8 space-y-4">
          <CoverImage day={activeDay} fallbackImageUrl={fallback} />
          <div className="text-center">
            <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {titleLine}
            </h3>
            {activeDay.title && (
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)] sm:text-base">
                {activeDay.title}
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

        {/* 3) ??????? ???? ??? ??? + ?? ????????? ???????????? ??? ?? */}
        {activeDay.events.length >= 1 ? (
          <div className="relative">
            <div className="hidden md:block">
              <div className="absolute left-0 top-0 bottom-0 w-6" aria-hidden>
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--primary)]/20" />
              </div>
              <div className="flex flex-col space-y-10">
                {displayEvents.map((ev, i) => {
                  const isSelected =
                    onEventSelect != null &&
                    selectedDayIndex === activeIndex &&
                    selectedEventIndex === i;
                  return (
                    <div
                      key={`${ev.heading}-${i}`}
                      ref={isSelected ? selectedCardRef : undefined}
                      className="flex items-start gap-4"
                    >
                      <div className="w-6 shrink-0 flex justify-center pt-5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]/50 ring-2 ring-[var(--surface)]" aria-hidden />
                      </div>
                      <div
                        className={`min-w-0 flex-1 rounded-2xl transition ${
                          isSelected
                            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
                            : ""
                        } ${onEventSelect ? "cursor-pointer" : ""}`}
                        role={onEventSelect ? "button" : undefined}
                        tabIndex={onEventSelect ? 0 : undefined}
                        onClick={
                          onEventSelect
                            ? () => onEventSelect(activeIndex, i)
                            : undefined
                        }
                        onKeyDown={
                          onEventSelect
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onEventSelect(activeIndex, i);
                                }
                              }
                            : undefined
                        }
                      >
                        <TimelineEventCard
                          event={ev}
                          normalizeUrl={normalizeProductImageUrl}
                          productId={productId}
                          dayIndex={activeIndex}
                          eventIndex={i}
                          onImageOpen={(idx) =>
                            productId &&
                            trackProductItineraryImageOpen({
                              productId,
                              dayIndex: activeIndex,
                              eventIndex: i,
                              imageIndex: idx,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ???: ?? ??, ?? ?? */}
            <div className="space-y-6 md:hidden">
              {displayEvents.map((ev, i) => {
                const isSelected =
                  onEventSelect != null &&
                  selectedDayIndex === activeIndex &&
                  selectedEventIndex === i;
                return (
                  <div
                    key={`${ev.heading}-${i}`}
                    ref={isSelected ? selectedCardRef : undefined}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-6 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]/40" aria-hidden />
                    <div
                      className={`min-w-0 flex-1 rounded-2xl transition ${
                        isSelected ? "ring-2 ring-[var(--primary)]" : ""
                      } ${onEventSelect ? "cursor-pointer" : ""}`}
                      role={onEventSelect ? "button" : undefined}
                      tabIndex={onEventSelect ? 0 : undefined}
                      onClick={
                        onEventSelect ? () => onEventSelect(activeIndex, i) : undefined
                      }
                      onKeyDown={
                        onEventSelect
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onEventSelect(activeIndex, i);
                              }
                            }
                          : undefined
                      }
                    >
                      <TimelineEventCard
                        event={ev}
                        normalizeUrl={normalizeProductImageUrl}
                        productId={productId}
                        dayIndex={activeIndex}
                        eventIndex={i}
                        onImageOpen={(idx) =>
                          productId &&
                          trackProductItineraryImageOpen({
                            productId,
                            dayIndex: activeIndex,
                            eventIndex: i,
                            imageIndex: idx,
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-center">
              {showMoreButton}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">이 일차에 등록된 일정이 없습니다.</p>
        )}

        {/* 하단 Day 탭 (여러 일차일 때만) */}
        {days.length > 1 && (
          <div className="mt-8 border-t border-[var(--divider)] pt-4">
            <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">다른 일차 보기</p>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={`day-bottom-${d.day}-${i}`}
                  type="button"
                  onClick={() => handleDayTab(i, true, "tabs")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeIndex === i
                      ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                      : "bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]/80"
                  }`}
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
