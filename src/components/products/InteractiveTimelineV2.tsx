"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type {
  TimelineModel,
  TimelineDay,
  TimelineEvent,
} from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { TimelineEventCard } from "@/components/products/timeline/TimelineEventCard";

export type InteractiveTimelineV2Props = {
  model: TimelineModel;
  /** Day??????? ??? ???????URL (product.image_url ?? */
  fallbackImageUrl?: string | null;
  onDayChange?: (day: number) => void;
  /** [STEP 6] ??? ???: Day?????????? N?? ??? ??"??????????. ?????????? ??? */
  maxEventsVisible?: number;
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
      <span className="text-sm font-medium">Day {day.day} ?????????</span>
    </div>
  );
}

export function InteractiveTimelineV2({
  model,
  fallbackImageUrl = null,
  onDayChange,
  maxEventsVisible,
}: InteractiveTimelineV2Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  /** [STEP 6] ??? ????? Day??'????? ??? ???? (Day ?? ??) */
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  if (!model?.days?.length) return null;

  const days = model.days;
  const activeDay = days[activeIndex] ?? days[0];
  const fallback = fallbackImageUrl?.trim() ?? "";

  const isExpanded = expandedDays.has(activeDay.day);
  const displayEvents =
    maxEventsVisible != null && activeDay.events.length > maxEventsVisible && !isExpanded
      ? activeDay.events.slice(0, maxEventsVisible)
      : activeDay.events;
  const hasMore =
    maxEventsVisible != null && activeDay.events.length > maxEventsVisible && !isExpanded;
  const moreCount = hasMore ? activeDay.events.length - maxEventsVisible! : 0;

  const handleDayTab = (index: number, scrollToTop = false) => {
    setActiveIndex(index);
    const day = days[index];
    if (day) onDayChange?.(day.day);
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
          {isExpanded ? "??" : `??? (${moreCount}? ?)`}
        </button>
      </div>
    ) : null;

  const titleLine = activeDay.dateText
    ? `Day ${activeDay.day} - ${activeDay.dateText}`
    : `Day ${activeDay.day}`;

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
      aria-label="??? ???"
    >
      <div className="p-4 sm:p-6">
        <div ref={topAnchorRef} />
        {/* 1) ??? Day ??*/}
        <div className="mb-6 flex flex-wrap gap-2">
          {days.map((d, i) => (
            <button
              key={`day-${d.day}-${i}`}
              type="button"
              onClick={() => handleDayTab(i)}
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

        {/* 2) ??? Day: ??????? + ?????? + ??? ?????? */}
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
                {displayEvents.map((ev, i) => (
                  <div key={`${ev.heading}-${i}`} className="flex items-start gap-4">
                    <div className="w-6 shrink-0 flex justify-center pt-5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]/50 ring-2 ring-[var(--surface)]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <TimelineEventCard event={ev} normalizeUrl={normalizeProductImageUrl} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ???: ?? ??, ?? ?? */}
            <div className="space-y-6 md:hidden">
              {displayEvents.map((ev, i) => (
                <div key={`${ev.heading}-${i}`} className="flex items-start gap-3">
                  <span className="mt-6 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]/40" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <TimelineEventCard event={ev} normalizeUrl={normalizeProductImageUrl} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              {showMoreButton}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">?? ?? ???? ????.</p>
        )}

        {/* ??? Day ?? ??? ??? ????? Day???? ??? */}
        {days.length > 1 && (
          <div className="mt-8 border-t border-[var(--divider)] pt-4">
            <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">?? ?? ????</p>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={`day-bottom-${d.day}-${i}`}
                  type="button"
                  onClick={() => handleDayTab(i, true)}
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
      </div>
    </section>
  );
}
