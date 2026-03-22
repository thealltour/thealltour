"use client";

import { useMemo } from "react";
import type { IconName } from "@/icons";
import { Icon } from "@/components/ui/Icon";
import type { TimelineEvent, TimeOfDayLabel } from "@/lib/products/mapProductToTimelineModel";
import { EventMediaSection, type EventMediaImage } from "./EventMediaSection";

const EVENT_ICON_KEYS: Record<string, IconName> = {
  plane: "flight",
  hotel: "hotel",
  utensils: "utensils",
  landmark: "landmark",
  flag: "flag",
  clock: "clock",
  car: "flight",
  map: "region",
  golf: "golf",
  sun: "healing",
};

const TIMEOFDAY_LABELS: Record<TimeOfDayLabel, string> = {
  오전: "오전",
  오후: "오후",
  저녁: "저녁",
  종일: "종일",
};

function eventToMediaImages(event: TimelineEvent): EventMediaImage[] {
  const list = event.images ?? [];
  if (list.length === 0) return [];
  return list.filter((item) => item?.url?.trim() && /^https?:\/\//i.test(item.url.trim()));
}

export type TimelineEventCardProps = {
  event: TimelineEvent;
  normalizeUrl: (url: string) => string;
  productId?: string;
  dayIndex?: number;
  eventIndex?: number;
  /** 상세일정 이미지 모달 제거로 현재는 호출되지 않음 (API 호환용) */
  onImageOpen?: (imageIndex: number) => void;
};

export function TimelineEventCard({ event, normalizeUrl }: TimelineEventCardProps) {
  const brandIcon = event.iconKey ? EVENT_ICON_KEYS[event.iconKey] : undefined;
  const mediaImages = useMemo(() => eventToMediaImages(event), [event.images]);
  const hasImages = mediaImages.length > 0;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      {/* PR13: 1) 시간 2) 이벤트명 3) 설명 위계 강화 */}
      <div className="flex items-start gap-3 space-y-0">
        {(event.timeOfDay != null || event.timeText?.trim()) ? (
          <div className="shrink-0 text-right">
            <span className="block text-sm font-semibold text-[var(--primary)]">
              {event.timeText?.trim() || (event.timeOfDay != null ? TIMEOFDAY_LABELS[event.timeOfDay] : "")}
            </span>
            {event.timeText?.trim() && event.timeOfDay != null && (
              <span className="text-xs text-[var(--text-muted)]">{TIMEOFDAY_LABELS[event.timeOfDay]}</span>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {brandIcon ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <Icon name={brandIcon} decorative size={16} className="h-4 w-4" />
              </div>
            ) : null}
            <h4 className="min-w-0 flex-1 text-lg font-semibold leading-tight text-[var(--text-primary)]" title={event.heading}>
              {event.heading}
            </h4>
          </div>
          {event.description && (
            <p className="line-clamp-3 text-sm leading-7 text-[var(--text-muted)] whitespace-pre-wrap">
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
            eventTitle={event.heading}
          />
        </div>
      )}
    </article>
  );
}
