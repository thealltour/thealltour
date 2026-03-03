"use client";

import type { ItineraryStructuredDay, ItineraryStructuredEvent, SelectedEventRef } from "@/types/product";
import { StructuredDayCard } from "./StructuredDayCard";

export type StructuredDaysEditorProps = {
  /** 구조화 일정 배열. 빈 배열이면 "일차 추가" 빈 상태 표시 */
  days: ItineraryStructuredDay[];
  /** 일차 배열 갱신. updater(prev) => next 형태로 호출 */
  onDaysChange: (updater: (prev: ItineraryStructuredDay[]) => ItineraryStructuredDay[]) => void;
  /** 일차 카드 포커스 시 (미리보기 동기화용) */
  onDayFocus?: (dayIndex: number) => void;
  /** 상품 이미지 → 이벤트에 추가 시 참조할 선택 이벤트 */
  selectedEvent: SelectedEventRef | null;
  onSelectEvent: (ref: SelectedEventRef) => void;
};

const EMPTY_DAY_FIRST: ItineraryStructuredDay = {
  day: 1,
  title: "",
  events: [
    { heading: "", description: undefined, timeOfDay: undefined, iconKey: undefined },
  ],
};

const EMPTY_EVENT: ItineraryStructuredEvent = {
  heading: "",
  description: undefined,
  timeOfDay: undefined,
  iconKey: undefined,
};

export function StructuredDaysEditor({
  days,
  onDaysChange,
  onDayFocus,
  selectedEvent,
  onSelectEvent,
}: StructuredDaysEditorProps) {
  const addFirstDay = () => {
    onDaysChange(() => [EMPTY_DAY_FIRST]);
  };

  const addDay = () => {
    onDaysChange((prev) => [
      ...prev,
      {
        day: prev.length + 1,
        title: "",
        events: [EMPTY_EVENT],
      },
    ]);
  };

  const removeDay = (dayIndex: number) => {
    onDaysChange((prev) =>
      prev.filter((_, i) => i !== dayIndex).map((d, i) => ({ ...d, day: i + 1 })),
    );
  };

  const updateDay = (dayIndex: number, patch: Partial<ItineraryStructuredDay>) => {
    onDaysChange((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)),
    );
  };

  const addEvent = (dayIndex: number) => {
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, events: [...d.events, EMPTY_EVENT] } : d,
      ),
    );
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
          : d,
      ),
    );
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ItineraryStructuredEvent>,
  ) => {
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...patch } : e,
              ),
            }
          : d,
      ),
    );
  };

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)]">
          Day별로 이벤트를 입력하면 상세 페이지에서 시각화 타임라인으로 표시됩니다. 시간대·아이콘을 선택하면 타임라인에 반영됩니다.
        </p>
        <button
          type="button"
          onClick={addFirstDay}
          className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-6 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 일차 추가 (구조화 일정 시작)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-secondary)]">
        Day별로 이벤트를 입력하면 상세 페이지에서 시각화 타임라인으로 표시됩니다. 시간대·아이콘을 선택하면 타임라인에 반영됩니다.
      </p>
      <div className="space-y-3">
        {days.map((dayEntry, dayIndex) => (
          <StructuredDayCard
            key={`day-${dayEntry.day}-${dayIndex}`}
            day={dayEntry}
            dayIndex={dayIndex}
            onDayChange={(patch) => updateDay(dayIndex, patch)}
            onAddEvent={() => addEvent(dayIndex)}
            onRemoveDay={() => removeDay(dayIndex)}
            onEventChange={(evIndex, patch) => updateEvent(dayIndex, evIndex, patch)}
            onRemoveEvent={(evIndex) => removeEvent(dayIndex, evIndex)}
            onFocus={() => onDayFocus?.(dayIndex)}
            selectedEvent={selectedEvent}
            onEventSelect={(evIndex) => onSelectEvent({ editorType: "structured", dayIndex, eventIndex: evIndex })}
          />
        ))}
        <button
          type="button"
          onClick={addDay}
          className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 일차 추가
        </button>
      </div>
    </div>
  );
}
