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
  return list
    .filter((item) => item?.url?.trim() && /^https?:\/\//i.test(item.url.trim()))
    .map((item) => ({ url: item.url, alt: item.alt }));
}

function eventToMediaImages(event: TimelineEvent): EventMediaImage[] {
  const list = event.images ?? [];
  if (list.length === 0) return [];
  return list.filter((item) => item?.url?.trim() && /^https?:\/\//i.test(item.url.trim()));
}

export type TimelineEventCardProps = {
  event: TimelineEvent;
  normalizeUrl: (url: string) => string;
  /** PR20: 이미지 lightbox 열 때 계측용 */
  productId?: string;
  dayIndex?: number;
  eventIndex?: number;
  onImageOpen?: (imageIndex: number) => void;
};

export function TimelineEventCard({ event, normalizeUrl, productId, dayIndex, eventIndex, onImageOpen }: TimelineEventCardProps) {
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
    onImageOpen?.(index);
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {/* 시간(왼쪽/강조) + 제목 + 아이콘 — 스캔 우선 */}
      <div className="mb-3 flex items-start gap-3">
        {(event.timeOfDay != null || event.timeText?.trim()) ? (
          <div className="shrink-0 text-right">
            <span className="block text-sm font-bold text-[var(--primary)]">
              {event.timeText?.trim() || (event.timeOfDay != null ? TIMEOFDAY_LABELS[event.timeOfDay] : "")}
            </span>
            {event.timeText?.trim() && event.timeOfDay != null && (
              <span className="text-xs text-[var(--text-muted)]">{TIMEOFDAY_LABELS[event.timeOfDay]}</span>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {Icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <h4 className="min-w-0 flex-1 text-base font-bold leading-tight text-[var(--text-primary)] md:text-lg" title={event.heading}>
              {event.heading}
            </h4>
          </div>
          {/* 설명: line-clamp로 후순위, 보조 정보 */}
          {event.description && (
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {/* 미디어: 시간/제목/설명 아래 */}
      {hasImages && (
        <div className="mt-4">
          <EventMediaSection
            images={mediaImages}
            normalizeUrl={normalizeUrl}
            onOpenLightbox={openLightbox}
            eventTitle={event.heading}
          />
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
