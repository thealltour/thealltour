"use client";

import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event, SelectedEventRef } from "@/types/product";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { itineraryV2ToTimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { parseLegacyItineraryText } from "@/lib/products/parseLegacyItineraryText";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { V2DayCard } from "@/components/admin/itinerary/v2/V2DayCard";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";

const DEFAULT_EVENTS_TEMPLATE: ItineraryV2Event[] = [
  { heading: "이동", description: "", timeOfDay: "오전", iconKey: "car" },
  { heading: "식사", description: "", timeOfDay: "오후", iconKey: "utensils" },
];

function createEmptyDay(dayNumber: number): ItineraryV2Day {
  return {
    day: dayNumber,
    dateText: "",
    title: "",
    coverImageUrl: "",
    events: [{ heading: "", description: "" }, { heading: "", description: "" }],
  };
}

export type ScheduleVisualEditorV2Props = {
  form: {
    itinerary_v2_json: ItineraryV2;
    legacy_itinerary_text: string;
    images_json?: string[];
    image_url?: string;
  };
  /** ProductFormState와 같은 상위 타입 setState도 허용 */
  setForm: React.Dispatch<React.SetStateAction<any>>;
  previewProductImageUrl: string;
  activeDayIndex: number;
  setActiveDayIndex: (index: number) => void;
  /** 상품 이미지 → 이벤트에 추가 시 참조할 선택 이벤트 */
  selectedEvent: SelectedEventRef | null;
  onSelectEvent: (ref: SelectedEventRef | null) => void;
};

export function ScheduleVisualEditorV2({
  form,
  setForm,
  previewProductImageUrl,
  activeDayIndex,
  setActiveDayIndex,
  selectedEvent,
  onSelectEvent,
}: ScheduleVisualEditorV2Props) {
  const v2 = form.itinerary_v2_json;
  const days = v2.days ?? [];
  const productImageCandidates = Array.from(
    new Set(
      [
        ...(Array.isArray(form.images_json) ? form.images_json : []),
        form.image_url ?? "",
      ]
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u)),
    ),
  );

  const updateV2 = (updater: (prev: ItineraryV2) => ItineraryV2) => {
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: updater(prev.itinerary_v2_json),
    }));
  };

  const applyLegacyDraft = () => {
    const text = form.legacy_itinerary_text?.trim() ?? "";
    const draft = parseLegacyItineraryText(text);
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: draft,
    }));
  };

  const addDay = () => {
    updateV2((prev) => ({
      days: [...prev.days, createEmptyDay(prev.days.length + 1)],
    }));
  };

  const removeDay = (dayIndex: number) => {
    updateV2((prev) => ({
      days: prev.days
        .filter((_, i) => i !== dayIndex)
        .map((d, i) => ({ ...d, day: i + 1 })),
    }));
    setActiveDayIndex(Math.max(0, Math.min(activeDayIndex, days.length - 2)));
  };

  const moveDay = (dayIndex: number, direction: "up" | "down") => {
    if (direction === "up" && dayIndex <= 0) return;
    if (direction === "down" && dayIndex >= days.length - 1) return;
    const next = [...days];
    const swap = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    [next[dayIndex], next[swap]] = [next[swap], next[dayIndex]];
    updateV2(() => ({
      days: next.map((d, i) => ({ ...d, day: i + 1 })),
    }));
    if (activeDayIndex === dayIndex) setActiveDayIndex(swap);
    else if (activeDayIndex === swap) setActiveDayIndex(dayIndex);
  };

  const updateDay = (dayIndex: number, patch: Partial<ItineraryV2Day>) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)),
    }));
  };

  const addEvent = (dayIndex: number) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: [
                ...d.events,
                {
                  heading: "새 이벤트",
                  description: "",
                  timeText: "",
                  timeOfDay: "오후",
                  iconKey: "",
                },
              ],
            }
          : d,
      ),
    }));
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    const wasSelected =
      selectedEvent?.editorType === "v2" &&
      selectedEvent.dayIndex === dayIndex &&
      selectedEvent.eventIndex === eventIndex;
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
          : d,
      ),
    }));
    if (wasSelected) onSelectEvent(null);
  };

  const moveEvent = (dayIndex: number, eventIndex: number, direction: "up" | "down") => {
    const day = days[dayIndex];
    if (!day || day.events.length < 2) return;
    if (direction === "up" && eventIndex <= 0) return;
    if (direction === "down" && eventIndex >= day.events.length - 1) return;
    const nextEvents = [...day.events];
    const swap = direction === "up" ? eventIndex - 1 : eventIndex + 1;
    [nextEvents[eventIndex], nextEvents[swap]] = [nextEvents[swap], nextEvents[eventIndex]];
    updateDay(dayIndex, { events: nextEvents });
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ItineraryV2Event>,
  ) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...patch } : e,
              ),
            }
          : d,
      ),
    }));
  };

  const createSkeleton = (dayCount: number) => {
    const newDays = Array.from({ length: dayCount }, (_, i) =>
      createEmptyDay(i + 1),
    ).map((d) => ({
      ...d,
      events: [...DEFAULT_EVENTS_TEMPLATE],
    }));
    updateV2(() => ({ days: newDays }));
  };

  const timelineModel = itineraryV2ToTimelineModel(v2);
  const fallbackUrl = previewProductImageUrl?.trim()
    ? normalizeProductImageUrl(previewProductImageUrl) || previewProductImageUrl
    : null;

  return (
    <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-secondary)]">
            Day와 이벤트를 입력하면 상세 페이지에서 타임라인으로 표시됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createSkeleton(3)}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-90"
            >
              기본 골격 생성 (3일)
            </button>
            <button
              type="button"
              onClick={addDay}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              + Day 추가
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)]/50 p-3">
          <HintDisclosure
            id="schedule.legacyTextGuide"
            summary="레거시 텍스트를 붙여넣어 Day/이벤트 초안을 생성할 수 있습니다."
          >
            {`기존 일정 텍스트를 붙여넣고 버튼을 누르면 Day/이벤트 초안이 생성됩니다. "1일차", "Day 1", "[2일차]" 등으로 구분된 텍스트를 지원합니다.

아래 입력란에 예시처럼 일차별로 구분해 붙여넣은 뒤 "레거시 텍스트로 초안 만들기" 버튼을 누르세요.`}
          </HintDisclosure>
          <textarea
            value={form.legacy_itinerary_text ?? ""}
            onChange={(e) =>
              setForm((prev: any) => ({
                ...prev,
                legacy_itinerary_text: e.target.value,
              }))
            }
            placeholder={"예시:\n[1일차]\n집결/인천국제공항 제1터미널 집결/오후/19:40\n출발/티웨이항공(TW) 인천(ICN) 출발 (약 10시간 35분 소요)/오후/21:40\n식사/석식: 기내식\n숙박/기내박\n\n\n[2일차]\n미팅/시드니(SYD) 공항 도착 및 가이드 미팅/오전/10:15 \n관광/시드니 동부 해안 관광/오후\n본다이 비치/시드니 최고의 서핑 명소 및 해변 관람"}
            rows={4}
            className="mb-2 mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={applyLegacyDraft}
            className="rounded-lg border border-[var(--warning)]/50 bg-[var(--warning-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] hover:opacity-90"
          >
            레거시 텍스트로 초안 만들기
          </button>
        </div>

        {days.length === 0 ? (
          <button
            type="button"
            onClick={() => createSkeleton(3)}
            className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-8 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            기본 골격 생성으로 시작하거나 Day 추가
          </button>
        ) : (
          <div className="space-y-4">
            {days.map((dayEntry, dayIndex) => (
              <V2DayCard
                key={`v2-day-${dayEntry.day}-${dayIndex}`}
                day={dayEntry}
                dayIndex={dayIndex}
                totalDays={days.length}
                productImageCandidates={productImageCandidates}
                onDayChange={(patch) => updateDay(dayIndex, patch)}
                onAddEvent={() => addEvent(dayIndex)}
                onRemoveDay={() => removeDay(dayIndex)}
                onMoveDayUp={() => moveDay(dayIndex, "up")}
                onMoveDayDown={() => moveDay(dayIndex, "down")}
                onEventChange={(evIndex, patch) => updateEvent(dayIndex, evIndex, patch)}
                onRemoveEvent={(evIndex) => removeEvent(dayIndex, evIndex)}
                onMoveEvent={(evIndex, direction) => moveEvent(dayIndex, evIndex, direction)}
                onFocus={() => setActiveDayIndex(dayIndex)}
                selectedEvent={selectedEvent}
                onEventSelect={(evIndex) => onSelectEvent({ editorType: "v2", dayIndex, eventIndex: evIndex })}
              />
            ))}
            <button
              type="button"
              onClick={addDay}
              className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              + Day 추가
            </button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">실시간 타임라인 미리보기</p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
          {timelineModel.days.length > 0 ? (
            <InteractiveTimelineV2
              model={timelineModel}
              fallbackImageUrl={fallbackUrl}
              onDayChange={setActiveDayIndex}
              selectedDayIndex={selectedEvent?.editorType === "v2" ? selectedEvent.dayIndex : undefined}
              selectedEventIndex={
                selectedEvent?.editorType === "v2" ? selectedEvent.eventIndex : undefined
              }
              onEventSelect={(dayIndex, eventIndex) =>
                onSelectEvent({ editorType: "v2", dayIndex, eventIndex })
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg bg-[var(--surface-muted)] py-12 text-center text-sm text-[var(--text-muted)]">
              Day를 추가하면 여기에 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
