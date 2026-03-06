"use client";

import type { ItineraryStructuredDay, ItineraryStructuredEvent, SelectedEventRef } from "@/types/product";
import { StructuredEventRow } from "./StructuredEventRow";

export type StructuredDayCardProps = {
  day: ItineraryStructuredDay;
  dayIndex: number;
  onDayChange: (patch: Partial<ItineraryStructuredDay>) => void;
  onAddEvent: () => void;
  onRemoveDay: () => void;
  onEventChange: (eventIndex: number, patch: Partial<ItineraryStructuredEvent>) => void;
  onRemoveEvent: (eventIndex: number) => void;
  onFocus?: () => void;
  selectedEvent?: SelectedEventRef | null;
  onEventSelect?: (eventIndex: number) => void;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  onDropExternalImage?: (
    item: { source: "unassigned"; url: string },
    destination: { editorType: "structured"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
};

const EMPTY_EVENT: ItineraryStructuredEvent = {
  heading: "",
  description: undefined,
  timeOfDay: undefined,
  iconKey: undefined,
};

export function StructuredDayCard({
  day,
  dayIndex,
  onDayChange,
  onAddEvent,
  onRemoveDay,
  onEventChange,
  onRemoveEvent,
  onFocus,
  selectedEvent,
  onEventSelect,
  modetourDnDEnabled,
  onDropExternalImage,
  onReturnImageToPool,
}: StructuredDayCardProps) {
  const events = day.events ?? [];

  return (
    <article
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      onFocus={onFocus}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8] dark:bg-[var(--primary-soft)] dark:text-[var(--primary)]">
          Day {day.day}
        </span>
        <input
          value={day.title ?? ""}
          onChange={(e) =>
            onDayChange({
              title: e.target.value.trim() || undefined,
            })
          }
          placeholder="일차 제목 (선택)"
          className="max-w-xs rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] dark:bg-[var(--surface)]"
        />
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onRemoveDay}
            className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50 dark:border-[var(--danger)]/30 dark:bg-[var(--danger-bg)] dark:text-[var(--danger)] dark:hover:opacity-90"
          >
            일차 삭제
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {events.map((ev, evIndex) => (
          <StructuredEventRow
            key={`ev-${dayIndex}-${evIndex}`}
            event={ev}
            eventIndex={evIndex}
            onEventChange={(patch) => onEventChange(evIndex, patch)}
            onRemove={() => onRemoveEvent(evIndex)}
            onSelect={onEventSelect ? () => onEventSelect(evIndex) : undefined}
            isSelected={
              selectedEvent?.editorType === "structured" &&
              selectedEvent.dayIndex === dayIndex &&
              selectedEvent.eventIndex === evIndex
            }
            modetourDnDEnabled={modetourDnDEnabled}
            dayIndex={dayIndex}
            onDropExternalImage={onDropExternalImage}
            onReturnImageToPool={onReturnImageToPool}
          />
        ))}
        <button
          type="button"
          onClick={onAddEvent}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          + 이벤트 추가
        </button>
      </div>
    </article>
  );
}
