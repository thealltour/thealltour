"use client";

import type { ItineraryV2Event } from "@/types/product";
import { EventImagesEditor } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { EventImageItem } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import { ChevronDown } from "lucide-react";

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

export type EventEditorProps = {
  event: ItineraryV2Event | null;
  onChange: (patch: Partial<ItineraryV2Event>) => void;
  onRemove?: () => void;
  /** 모두투어 미할당 이미지 DnD (ModetourNewProductPage 전용) */
  modetourDnDEnabled?: boolean;
  dayIndex?: number;
  eventIndex?: number;
  onDropExternalImage?: (
    item: { source: "unassigned"; url: string },
    destination: { editorType: "v2"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
};

export function EventEditor({
  event,
  onChange,
  onRemove,
  modetourDnDEnabled,
  dayIndex = 0,
  eventIndex = 0,
  onDropExternalImage,
  onReturnImageToPool,
}: EventEditorProps) {
  if (event == null) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 py-16 text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          왼쪽 목록에서 이벤트를 선택하세요.
        </p>
      </div>
    );
  }

  const imagesList: EventImageItem[] = event.images ?? [];

  const handleImagesChange = (nextImages: EventImageItem[]) => {
    if (nextImages.length === 0) {
      onChange({ images: [] });
      return;
    }
    const hasCover = nextImages.some((i) => i.isCover);
    const normalized = nextImages.map((item, index) => ({
      ...item,
      sortOrder: index,
      isCover: hasCover ? item.isCover === true : index === 0,
    }));
    if (!normalized.some((i) => i.isCover)) {
      normalized[0] = { ...normalized[0], isCover: true };
    }
    onChange({ images: normalized });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">이벤트 편집</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] text-[var(--danger)] hover:opacity-90"
          >
            삭제
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">제목</label>
        <input
          value={event.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
          placeholder="제목 (필수)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">시각</label>
          <input
            type="text"
            value={event.timeText ?? ""}
            onChange={(e) =>
              onChange({ timeText: e.target.value.trim() || undefined })
            }
            placeholder="09:00"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">구분</label>
          <select
            value={event.timeOfDay ?? ""}
            onChange={(e) =>
              onChange({
                timeOfDay: (e.target.value as ItineraryV2Event["timeOfDay"]) || undefined,
              })
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {TIMEOFDAY_OPTIONS.map((o) => (
              <option key={o.value || "x"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">유형</label>
        <select
          value={event.iconKey ?? ""}
          onChange={(e) =>
            onChange({ iconKey: e.target.value.trim() || undefined })
          }
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          {ICON_KEY_OPTIONS.map((o) => (
            <option key={o.value || "x"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">설명</label>
        <textarea
          value={event.description ?? ""}
          onChange={(e) =>
            onChange({
              description: e.target.value.trim() || undefined,
            })
          }
          placeholder="설명"
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
            이벤트 이미지 {imagesList.length > 0 ? `(${imagesList.length}장)` : ""}
          </summary>
          <div className="border-t border-[var(--border)] p-3">
            <EventImagesEditor
              value={imagesList}
              onChange={handleImagesChange}
              mode="full"
              dndContext={
                modetourDnDEnabled && onDropExternalImage && onReturnImageToPool && dayIndex != null && eventIndex != null
                  ? {
                      enabled: true,
                      editorType: "v2",
                      dayIndex,
                      eventIndex,
                      onDropExternalImage: (item: ModetourImageDragItem, destination) => {
                        if (item.source === "unassigned") {
                          onDropExternalImage(item, { ...destination, editorType: "v2" });
                        }
                      },
                      onReturnImageToPool,
                    }
                  : undefined
              }
            />
          </div>
        </details>
      </div>
    </div>
  );
}
