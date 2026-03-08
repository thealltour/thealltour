"use client";

import type { ItineraryStructuredDay, ItineraryStructuredEvent, SelectedEventRef } from "@/types/product";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import { normalizeEventImages } from "@/lib/images/normalizeEventImages";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
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
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "structured"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, import("@/components/admin/modetour/modetourImageValidation").ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
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
  modetourDnDEnabled,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
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
    if (days.length <= 1) return;
    onDaysChange((prev) =>
      prev.filter((_, i) => i !== dayIndex).map((d, i) => ({ ...d, day: i + 1 })),
    );
  };

  const handleConfirmRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    const day = days[dayIndex];
    if (!day) return;
    const eventCount = day.events?.length ?? 0;
    const message =
      eventCount > 0
        ? `Day ${day.day} 전체를 삭제할까요?\n해당 Day의 이벤트 ${eventCount}개와 이미지 연결 정보가 함께 제거됩니다.`
        : `Day ${day.day} 전체를 삭제할까요?`;
    if (!window.confirm(message)) return;
    removeDay(dayIndex);
  };

  const handleConfirmRemoveEvent = (dayIndex: number, eventIndex: number) => {
    const day = days[dayIndex];
    const ev = day?.events?.[eventIndex];
    const title = ev?.heading?.trim() || "이 이벤트";
    if (
      !window.confirm(
        `'${title}'를 삭제할까요?\n이벤트에 연결된 이미지 정보도 함께 사라집니다.`,
      )
    )
      return;
    removeEvent(dayIndex, eventIndex);
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
    const nextPatch = { ...patch };
    if (nextPatch.images != null) {
      const normalized = normalizeEventImages(nextPatch.images);
      nextPatch.images = dedupeEventImages(normalized);
    }
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...nextPatch } : e,
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
            totalDays={days.length}
            onDayChange={(patch) => updateDay(dayIndex, patch)}
            onAddEvent={() => addEvent(dayIndex)}
            onRemoveDay={() => handleConfirmRemoveDay(dayIndex)}
            onEventChange={(evIndex, patch) => updateEvent(dayIndex, evIndex, patch)}
            onRemoveEvent={(evIndex) => handleConfirmRemoveEvent(dayIndex, evIndex)}
            onFocus={() => onDayFocus?.(dayIndex)}
            selectedEvent={selectedEvent}
            onEventSelect={(evIndex) => onSelectEvent({ editorType: "structured", dayIndex, eventIndex: evIndex })}
            modetourDnDEnabled={modetourDnDEnabled}
            onDropExternalImage={onDropExternalImage}
            onReturnImageToPool={onReturnImageToPool}
            imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
            showPlacementWarnings={showPlacementWarnings}
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
