"use client";

import { useState } from "react";
import type { ItineraryV2Event } from "@/types/product";
import { EventImagesEditor } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { EventImageItem } from "@/components/admin/itinerary/shared/EventImagesEditor";
import { ChevronDown, ChevronRight } from "lucide-react";

const TIMEOFDAY_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "오전", label: "오전" },
  { value: "오후", label: "오후" },
  { value: "저녁", label: "저녁" },
  { value: "종일", label: "종일" },
] as const;

const ICON_KEY_OPTIONS = [
  { value: "", label: "없음" },
  { value: "car", label: "이동" },
  { value: "utensils", label: "식사" },
  { value: "golf", label: "골프" },
  { value: "hotel", label: "숙소" },
  { value: "map", label: "관광" },
  { value: "sun", label: "자유" },
] as const;

export type V2EventRowProps = {
  event: ItineraryV2Event;
  eventIndex: number;
  totalEvents: number;
  onEventChange: (patch: Partial<ItineraryV2Event>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
};

export function V2EventRow({
  event,
  eventIndex,
  totalEvents,
  onEventChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSelect,
  isSelected,
}: V2EventRowProps) {
  const [imagesOpen, setImagesOpen] = useState(false);
  const imagesList: EventImageItem[] = event.images ?? [];

  const handleImagesChange = (nextImages: EventImageItem[]) => {
    onEventChange({ images: nextImages });
  };

  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded-lg border p-2 transition ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/30 ring-1 ring-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface-muted)]/50"
      }`}
    >
      {onSelect != null ? (
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded border px-2 py-1 text-[11px] ${
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          }`}
        >
          {isSelected ? "선택됨" : "이 이벤트에 추가 대상"}
        </button>
      ) : null}
      <input
        value={event.heading}
        onChange={(e) => onEventChange({ heading: e.target.value })}
        placeholder="제목 (필수)"
        className="min-w-[90px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <textarea
        value={event.description ?? ""}
        onChange={(e) =>
          onEventChange({
            description: e.target.value.trim() || undefined,
          })
        }
        placeholder="설명 (원문 전체)"
        rows={3}
        className="min-h-[4.5rem] min-w-0 flex-1 resize-y rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <select
        value={event.timeOfDay ?? ""}
        onChange={(e) =>
          onEventChange({
            timeOfDay: (e.target.value as ItineraryV2Event["timeOfDay"]) || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
      >
        {TIMEOFDAY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={event.timeText ?? ""}
        onChange={(e) =>
          onEventChange({
            timeText: e.target.value.trim() || undefined,
          })
        }
        placeholder="시각 (09:00)"
        className="w-[72px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <select
        value={event.iconKey ?? ""}
        onChange={(e) =>
          onEventChange({
            iconKey: e.target.value.trim() || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
      >
        {ICON_KEY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex gap-0.5">
        <button
          type="button"
          disabled={eventIndex === 0}
          onClick={onMoveUp}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] disabled:opacity-40"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={eventIndex >= totalEvents - 1}
          onClick={onMoveDown}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] disabled:opacity-40"
        >
          ▼
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
      >
        삭제
      </button>

      <div className="w-full border-t border-[var(--border)] pt-2 mt-1">
        <button
          type="button"
          onClick={() => setImagesOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          {imagesOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          )}
          이벤트 이미지 {imagesList.length > 0 ? `(${imagesList.length}장)` : ""}
        </button>
        {imagesOpen && (
          <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
            <EventImagesEditor
              value={imagesList}
              onChange={handleImagesChange}
              mode="full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
