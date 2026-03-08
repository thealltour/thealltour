"use client";

import { useRef, useState, useMemo } from "react";
import {
  Plane,
  Hotel,
  UtensilsCrossed,
  Landmark,
  Flag,
  Clock,
} from "lucide-react";
import type { TimelineEvent, TimeOfDayLabel } from "@/lib/products/mapProductToTimelineModel";
import { Lightbox, type LightboxImage } from "@/components/ui/Lightbox";
import { EventMediaSection, type EventMediaImage } from "./EventMediaSection";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  plane: Plane,
  hotel: Hotel,
  utensils: UtensilsCrossed,
  landmark: Landmark,
  flag: Flag,
  clock: Clock,
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

function eventToLightboxImages(event: TimelineEvent): LightboxImage[] {
  const list = event.images ?? [];
  if (list.length === 0) return [];
  return list.map((item) => ({ url: item.url, alt: item.alt }));
}

function eventToMediaImages(event: TimelineEvent): EventMediaImage[] {
  const list = event.images ?? [];
  if (list.length === 0) return [];
  return [...list];
}

export type TimelineEventCardProps = {
  event: TimelineEvent;
  normalizeUrl: (url: string) => string;
};

export function TimelineEventCard({ event, normalizeUrl }: TimelineEventCardProps) {
  const Icon = event.iconKey ? EVENT_ICONS[event.iconKey] : null;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const returnFocusRef = useRef<HTMLButtonElement>(null);

  const lightboxImages = useMemo(() => eventToLightboxImages(event), [event.images]);
  const mediaImages = useMemo(() => eventToMediaImages(event), [event.images]);
  const hasImages = lightboxImages.length > 0;

  const openLightbox = (index: number, triggerButton: HTMLButtonElement) => {
    returnFocusRef.current = triggerButton;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {/* 상단: 시간 뱃지 + 제목 + 아이콘 */}
      <div className="mb-4 flex flex-wrap items-start gap-2">
        {event.timeOfDay && (
          <span className="inline-flex rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {TIMEOFDAY_LABELS[event.timeOfDay]}
            {event.timeText?.trim() ? ` ${event.timeText.trim()}` : ""}
          </span>
        )}
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <h4 className="min-w-0 flex-1 text-lg font-bold tracking-tight text-[var(--text-primary)]" title={event.heading}>
          {event.heading}
        </h4>
      </div>

      {/* 미디어 섹션: 대표 이미지 + 썸네일 스트립 + 크게보기 (이미지 있을 때만) */}
      {hasImages && (
        <div className="mb-4">
          <EventMediaSection
            images={mediaImages}
            normalizeUrl={normalizeUrl}
            onOpenLightbox={openLightbox}
            eventTitle={event.heading}
          />
        </div>
      )}

      {/* 설명 텍스트 */}
      {event.description && (
        <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
          {event.description}
        </div>
      )}

      {/* 라이트박스: 해당 이벤트 이미지만, 상단에 이벤트 제목 표시 */}
      {lightboxOpen && hasImages && (
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          returnFocusRef={returnFocusRef}
          normalizeUrl={normalizeUrl}
          title={event.heading}
        />
      )}
    </article>
  );
}
