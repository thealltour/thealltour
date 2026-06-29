"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
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
import { TimelineSummaryEventCard } from "@/components/products/timeline/TimelineSummaryEventCard";
import { EventMediaSection } from "@/components/products/timeline/EventMediaSection";
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
        className={`min-w-0 flex-1 rounded-2xl transition-colors transition-shadow duration-200 ${
          isSelected
            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
            : ""
        } ${onEventSelect ? "cursor-pointer" : ""} md:hover:shadow-sm md:hover:bg-[var(--surface-muted)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
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

/** PR17: index 기반 stagger 등장 애니메이션 wrapper. reduceMotion 시 즉시 표시 */
function StaggerRow({
  index,
  reduceMotion,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const duration = reduceMotion ? "1ms" : "320ms";
  const delay = reduceMotion ? "0ms" : `${Math.min(index * 45, 240)}ms`;
  return (
    <div
      className={`transition-all ease-out will-change-[opacity,transform] ${
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{ transitionDuration: duration, transitionDelay: delay }}
    >
      {children}
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
        } ${onEventSelect ? "cursor-pointer" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
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
  /** 관리자 편집기 등 임베드 시 선택 연동만 하고 페이지 스크롤은 하지 않음 */
  disableAutoScroll?: boolean;
  /** 고정 출발일 상품 CTA 문구 분기 */
  ctaLabelOptions?: import("@/lib/products/getProductCtaLabel").ProductCtaLabelOptions;
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
  const galleryImages =
    Array.isArray(day.coverImages) && day.coverImages.length > 0
      ? day.coverImages.filter((i) => i?.url?.trim())
      : [];
  if (galleryImages.length >= 2) {
    return (
      <div className="w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] shadow-lg">
        <EventMediaSection
          images={galleryImages}
          normalizeUrl={normalizeProductImageUrl}
          eventTitle={day.dateText ? `Day ${day.day} - ${day.dateText}` : `Day ${day.day}`}
        />
      </div>
    );
  }

  const singleFromGallery = galleryImages[0]?.url?.trim();
  const raw = singleFromGallery || day.imageUrl?.trim() || fallbackImageUrl?.trim() || "";
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
      <Icon name="image" decorative size={48} className="opacity-50" />
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
  disableAutoScroll = false,
  ctaLabelOptions,
  productId,
  status,
  productTitle,
  sourcePath,
  kakaoHref,
}: InteractiveTimelineV2Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [dayRenderKey, setDayRenderKey] = useState(0);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndicator, setActiveIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // PR17: prefers-reduced-motion 감지
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handle = () => setReduceMotion(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  if (!model?.days?.length) return null;

  const days = model.days;
  const fallback = fallbackImageUrl?.trim() ?? "";
  const activeDay = days[activeIndex] ?? days[0];

  // PR20: sticky Day 탭 active indicator 위치/너비 계산
  useEffect(() => {
    const measure = () => {
      const list = tabListRef.current;
      const btn = tabButtonRefs.current[activeIndex];
      if (!list || !btn) return;
      const left = btn.offsetLeft;
      const width = btn.offsetWidth;
      if (!width) return;
      setActiveIndicator({ left, width, ready: true });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, days.length]);

  // PR15-1 Step2: 미리보기 Day 클릭 시 activeIndex 동기화 (+ 상세 페이지에서만 상단 스크롤)
  useEffect(() => {
    if (disableAutoScroll) return;
    if (selectedDayIndex == null) return;
    if (selectedDayIndex < 0 || selectedDayIndex >= days.length) return;
    setActiveIndex(selectedDayIndex);
    setDayRenderKey((k) => k + 1);
    requestAnimationFrame(() => {
      topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedDayIndex, days.length, disableAutoScroll]);

  // 선택된 이벤트 카드로 스크롤 (상세 페이지 전용; 관리자 편집기에서는 비활성)
  useEffect(() => {
    if (disableAutoScroll) return;
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
  }, [selectedDayIndex, selectedEventIndex, activeIndex, disableAutoScroll]);

  // 관리자 편집기: Day/이벤트 선택 시 activeIndex만 동기화 (스크롤 없음)
  useEffect(() => {
    if (!disableAutoScroll) return;
    if (selectedDayIndex == null) return;
    if (selectedDayIndex < 0 || selectedDayIndex >= days.length) return;
    if (selectedDayIndex !== activeIndex) {
      setActiveIndex(selectedDayIndex);
      setDayRenderKey((k) => k + 1);
    }
  }, [selectedDayIndex, selectedEventIndex, days.length, activeIndex, disableAutoScroll]);

  const handleDayTab = (index: number, scrollToSection = false, source: "sticky_nav" | "tabs" = "tabs") => {
    if (index === activeIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(index);
      setDayRenderKey((k) => k + 1);
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsTransitioning(false));
      });
    }, 120);
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
  const activityEvents = displayEvents.filter(
    (ev) => ev.displayRole !== "summary" && !/^(예정호텔|호텔|식사)$/.test(ev.heading.trim()),
  );
  const summaryEvents = displayEvents.filter(
    (ev) => ev.displayRole === "summary" || /^(예정호텔|호텔|식사)$/.test(ev.heading.trim()),
  );
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
        {/* PR19/PR20: Sticky Day 탭 — 밀도 개선 + active indicator 모션 */}
        <div className="sticky top-16 z-20 -mx-4 -mt-4 mb-3 flex border-b border-[var(--border)]/80 bg-[var(--surface)]/90 px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] supports-[backdrop-filter]:bg-[var(--surface)]/95 sm:-mx-6 sm:-mt-6 sm:px-4 md:top-20">
          <div
            ref={tabListRef}
            className="scrollbar-hide relative flex w-full flex-nowrap gap-1.5 overflow-x-auto pb-0.5"
          >
            {/* active indicator layer */}
            {activeIndicator.ready && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-1 h-[2.25rem] rounded-md bg-[var(--primary)]/12 shadow-sm transition-all"
                style={{
                  transform: `translateX(${activeIndicator.left}px)`,
                  width: activeIndicator.width,
                  transitionDuration: reduceMotion ? "1ms" : "200ms",
                  transitionTimingFunction: "ease-out",
                }}
              />
            )}
            {days.map((d, i) => (
              <button
                key={`day-nav-${d.day}-${i}`}
                type="button"
                ref={(el) => {
                  tabButtonRefs.current[i] = el;
                }}
                onClick={() => handleDayTab(i, true, "sticky_nav")}
                className={`relative z-10 min-h-[2.25rem] shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] ${
                  activeIndex === i
                    ? "text-[var(--on-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-current={activeIndex === i ? "true" : undefined}
              >
                Day {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* PR15-1: activeDay 단일 섹션 렌더 (선택된 Day 1개만 본문 표시) */}
        {/* PR16: Day 전환 fade + translate 애니메이션 */}
        <section
          key={`day-${day.day}`}
          id={`itinerary-day-${day.day}`}
          className="scroll-mt-24 pb-10 md:scroll-mt-28"
          aria-label={titleLine}
        >
          <div
            key={day.day}
            className={`transition-all duration-300 ease-out ${
              isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            }`}
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
                  {activityEvents.map((ev, i) => {
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
                    const rowKey = `${day.day}-${dayRenderKey}-${ev.heading ?? i}-${i}`;
                    return (
                      <StaggerRow key={rowKey} index={i} reduceMotion={reduceMotion}>
                        <TimelineEventRowDesktop
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
                      </StaggerRow>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-5 md:hidden" aria-label="모바일 일정">
                {activityEvents.map((ev, i) => {
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
                  const rowKey = `${day.day}-${dayRenderKey}-${ev.heading ?? i}-${i}`;
                  return (
                    <StaggerRow key={rowKey} index={i} reduceMotion={reduceMotion}>
                      <TimelineEventRowMobile
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
                    </StaggerRow>
                  );
                })}
              </div>
              {summaryEvents.length > 0 ? (
                <div className="mt-8 space-y-3 border-t border-[var(--border)]/80 pt-6">
                  {summaryEvents.map((ev, i) => (
                    <TimelineSummaryEventCard key={`${day.day}-summary-${ev.heading}-${i}`} event={ev} />
                  ))}
                </div>
              ) : null}
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
          </div>
        </section>

        {/* PR13-1 / PR19: 하단 보조 Day 네비 — sticky와 톤 통일 */}
        {days.length > 1 && (
          <div className="mt-8 border-t border-[var(--border)] pt-4">
            <p className="mb-2.5 text-sm font-medium text-[var(--text-secondary)]">다른 일자 보기</p>
            <div className="scrollbar-hide flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
              {days.map((d, i) => (
                <button
                  key={`day-bottom-${d.day}-${i}`}
                  type="button"
                  onClick={() => handleDayTab(i, true, "tabs")}
                  className={`min-h-[2.25rem] shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] ${
                    activeIndex === i
                      ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/25"
                      : "bg-[var(--surface-muted)]/70 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  aria-current={activeIndex === i ? "true" : undefined}
                >
                  Day {d.day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PR21: 일정 하단 요약 + CTA 영역 */}
        {productId && productTitle != null && (
          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm sm:p-6">
            <div className="mx-auto max-w-xl space-y-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                상세 일정은 계절·현지 운영 상황에 따라 일부 조정될 수 있습니다.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                예약 전 출발 가능 일정과 포함 사항을 함께 확인해 주세요.
              </p>
            </div>
            <div className="mt-4">
              <ProductConsultCTA
                productId={productId}
                productTitle={productTitle}
                sourcePath={sourcePath ?? ""}
                status={status}
                kakaoHref={kakaoHref}
                section="itinerary"
                ctaLabelOptions={ctaLabelOptions}
                copy="이 일정이 마음에 드시나요?"
                subCopy="출발 가능 여부·맞춤 견적은 상담 후 안내해 드립니다."
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
