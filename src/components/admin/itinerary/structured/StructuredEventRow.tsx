"use client";

import { useState } from "react";
import type { ItineraryStructuredEvent } from "@/types/product";
import { EventImagesEditor } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { EventImageItem } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
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

export type StructuredEventRowProps = {
  event: ItineraryStructuredEvent;
  eventIndex: number;
  onEventChange: (patch: Partial<ItineraryStructuredEvent>) => void;
  onRemove: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  dayIndex?: number;
  onDropExternalImage?: (
    item: { source: "unassigned"; url: string },
    destination: { editorType: "structured"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
};

export function StructuredEventRow({
  event,
  eventIndex,
  onEventChange,
  onRemove,
  onSelect,
  isSelected,
  modetourDnDEnabled,
  dayIndex = 0,
  onDropExternalImage,
  onReturnImageToPool,
}: StructuredEventRowProps) {
  const [imagesOpen, setImagesOpen] = useState(false);
  const imagesList: EventImageItem[] = event.images ?? [];

  const handleImagesChange = (nextImages: EventImageItem[]) => {
    onEventChange({ images: nextImages });
  };

  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded border p-2 transition dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/50 ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/30 ring-1 ring-[var(--primary)] dark:border-[var(--primary)]"
          : "border-slate-100 bg-slate-50/50"
      }`}
    >
      {onSelect != null ? (
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded border px-2 py-1 text-[11px] ${
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] dark:bg-[var(--surface)]"
          }`}
        >
          {isSelected ? "선택됨" : "이 이벤트에 추가 대상"}
        </button>
      ) : null}
      <input
        value={event.heading}
        onChange={(e) => onEventChange({ heading: e.target.value })}
        placeholder="제목 (예: 이동, 식사)"
        className="min-w-[100px] rounded border border-[var(--border)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] dark:bg-[var(--surface)] dark:text-[var(--text-primary)]"
      />
      <input
        value={event.description ?? ""}
        onChange={(e) =>
          onEventChange({
            description: e.target.value.trim() || undefined,
          })
        }
        placeholder="설명"
        className="min-w-0 flex-1 rounded border border-[var(--border)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] dark:bg-[var(--surface)] dark:text-[var(--text-primary)]"
      />
      <select
        value={event.timeOfDay ?? ""}
        onChange={(e) =>
          onEventChange({
            timeOfDay: (e.target.value as ItineraryStructuredEvent["timeOfDay"]) || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] dark:text-[var(--text-primary)]"
      >
        {TIMEOFDAY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={event.iconKey ?? ""}
        onChange={(e) =>
          onEventChange({
            iconKey: e.target.value.trim() || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] dark:text-[var(--text-primary)]"
      >
        {ICON_KEY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
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
              dndContext={
                modetourDnDEnabled && onDropExternalImage && onReturnImageToPool && dayIndex != null
                  ? {
                      enabled: true,
                      editorType: "structured",
                      dayIndex,
                      eventIndex,
                      onDropExternalImage: (item: ModetourImageDragItem, destination) => {
                        if (item.source === "unassigned") {
                          onDropExternalImage(item, { ...destination, editorType: "structured" });
                        }
                      },
                      onReturnImageToPool,
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
