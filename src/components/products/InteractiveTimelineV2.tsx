"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Plane,
  Hotel,
  UtensilsCrossed,
  Landmark,
  Flag,
  Clock,
  ImageIcon,
} from "lucide-react";
import type {
  TimelineModel,
  TimelineDay,
  TimelineEvent,
  TimeOfDayLabel,
} from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type InteractiveTimelineV2Props = {
  model: TimelineModel;
  /** Day별 이미지 없을 때 사용할 URL (product.image_url 등) */
  fallbackImageUrl?: string | null;
  onDayChange?: (day: number) => void;
  /** [STEP 6] 요약 영역: Day당 이벤트 최대 N개만 노출 후 "더보기"로 펼침. 미설정 시 전부 노출 */
  maxEventsVisible?: number;
};

/** [STEP 6] 아이콘 기본값: 이동/항공→Plane, 숙소→Hotel, 식사→Utensils, 관광→Landmark, 골프→Flag, 자유→Clock */
const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  plane: Plane,
  hotel: Hotel,
  utensils: UtensilsCrossed,
  landmark: Landmark,
  flag: Flag,
  clock: Clock,
  /* 하위 호환 */
  car: Plane,
  map: Landmark,
  golf: Flag,
  sun: Clock,
};

const TIMEOFDAY_LABELS: Record<TimeOfDayLabel, string> = {
  오전: "오전",
  오후: "오후",
  저녁: "저녁",
  종일: "종일",
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
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-slate-200 shadow-lg">
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
      className="flex aspect-[21/9] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-500"
      aria-hidden
    >
      <ImageIcon className="h-12 w-12 opacity-50" />
      <span className="text-sm font-medium">Day {day.day} 대표 이미지</span>
    </div>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  const Icon = event.iconKey ? EVENT_ICONS[event.iconKey] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-[#1E3A8A]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {event.timeOfDay && (
            <span className="mb-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {TIMEOFDAY_LABELS[event.timeOfDay]}
              {event.timeText?.trim() ? ` ${event.timeText.trim()}` : ""}
            </span>
          )}
          <p className="font-semibold text-slate-900 line-clamp-1" title={event.heading}>
            {event.heading}
          </p>
          {event.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600 line-clamp-2" title={event.description}>
              {event.description}
            </p>
          )}
        </div>
      </div>
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
  /** [STEP 6] 요약 모드에서 Day별 '더보기' 펼침 여부 (Day 번호 집합) */
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

  const titleLine = activeDay.dateText
    ? `Day ${activeDay.day} - ${activeDay.dateText}`
    : `Day ${activeDay.day}`;

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg"
      aria-label="상세 일정"
    >
      <div className="p-4 sm:p-6">
        <div ref={topAnchorRef} />
        {/* 1) 상단 Day 탭 */}
        <div className="mb-6 flex flex-wrap gap-2">
          {days.map((d, i) => (
            <button
              key={`day-${d.day}-${i}`}
              type="button"
              onClick={() => handleDayTab(i)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeIndex === i
                  ? "bg-[#1E3A8A] text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Day {d.day}
            </button>
          ))}
        </div>

        {/* 2) 선택 Day: 큰 이미지 + 타이틀 + 서브 타이틀 */}
        <div className="mb-8 space-y-4">
          <CoverImage day={activeDay} fallbackImageUrl={fallback} />
          <div className="text-center">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {titleLine}
            </h3>
            {activeDay.title && (
              <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">
                {activeDay.title}
              </p>
            )}
          </div>
        </div>

        {/* 3) 타임라인: 세로 라인 + 이벤트 좌/우 (모바일에서는 단일 컬럼). [STEP 6] 요약 시 displayEvents만 노출 */}
        {activeDay.events.length > 0 ? (
          <div className="relative">
            {/* 데스크톱: 가운데 세로 라인 + 좌우 번갈아 */}
            <div className="hidden md:block">
              <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-[#2563eb]/30" />
              <div className="space-y-8">
                {displayEvents.map((ev, i) => {
                  const isLeft = ev.side === "left";
                  return (
                    <div key={`${ev.heading}-${i}`} className="relative flex w-full items-start">
                      <div className={`flex w-[calc(50%-14px)] ${isLeft ? "justify-end pr-4" : "justify-start pl-4"}`}>
                        {isLeft ? (
                          <div className="w-full max-w-sm">
                            <EventCard event={ev} />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex w-7 shrink-0 justify-center">
                        <span className="h-3 w-3 rounded-full bg-[#2563eb] ring-4 ring-white" />
                      </div>
                      <div className={`flex w-[calc(50%-14px)] ${isLeft ? "justify-start pl-4" : "justify-end pr-4"}`}>
                        {!isLeft ? (
                          <div className="w-full max-w-sm">
                            <EventCard event={ev} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 모바일: 단일 컬럼 스택 */}
            <div className="space-y-4 md:hidden">
              {displayEvents.map((ev, i) => (
                <div key={`${ev.heading}-${i}`} className="flex items-start gap-3">
                  <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
                  <div className="min-w-0 flex-1">
                    <EventCard event={ev} />
                  </div>
                </div>
              ))}
            </div>

            {/* [STEP 6] 요약 모드: 더보기 / 접기 */}
            {maxEventsVisible != null && activeDay.events.length > maxEventsVisible && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="rounded-lg border border-[#2563eb] bg-white px-4 py-2 text-sm font-semibold text-[#1E3A8A] shadow-sm transition hover:bg-[#eff6ff]"
                >
                  {isExpanded ? "접기" : `더보기 (${moreCount}개 더)`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">해당 일차 이벤트가 없습니다.</p>
        )}

        {/* 하단 Day 탭: 일차 확인 후 다음 Day로 바로 이동 */}
        {days.length > 1 && (
          <div className="mt-8 border-t border-[var(--divider)] pt-4">
            <p className="mb-3 text-xs font-semibold text-slate-500">다른 일차 바로가기</p>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={`day-bottom-${d.day}-${i}`}
                  type="button"
                  onClick={() => handleDayTab(i, true)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeIndex === i
                      ? "bg-[#1E3A8A] text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
