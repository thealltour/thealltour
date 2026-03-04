"use client";

import type { ItineraryV2Day, ItineraryV2Event, SelectedEventRef } from "@/types/product";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { V2EventRow } from "./V2EventRow";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type V2DayCardProps = {
  day: ItineraryV2Day;
  dayIndex: number;
  totalDays: number;
  productImageCandidates: string[];
  onDayChange: (patch: Partial<ItineraryV2Day>) => void;
  onAddEvent: () => void;
  onRemoveDay: () => void;
  onMoveDayUp: () => void;
  onMoveDayDown: () => void;
  onEventChange: (eventIndex: number, patch: Partial<ItineraryV2Event>) => void;
  onRemoveEvent: (eventIndex: number) => void;
  onMoveEvent: (eventIndex: number, direction: "up" | "down") => void;
  onFocus?: () => void;
  selectedEvent?: SelectedEventRef | null;
  onEventSelect?: (eventIndex: number) => void;
};

export function V2DayCard({
  day,
  dayIndex,
  totalDays,
  productImageCandidates,
  onDayChange,
  onAddEvent,
  onRemoveDay,
  onMoveDayUp,
  onMoveDayDown,
  onEventChange,
  onRemoveEvent,
  onMoveEvent,
  onFocus,
  selectedEvent,
  onEventSelect,
}: V2DayCardProps) {
  const events = day.events ?? [];

  return (
    <article
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
      onFocus={onFocus}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
          Day {day.day}
        </span>
        <input
          value={day.dateText ?? ""}
          onChange={(e) =>
            onDayChange({
              dateText: e.target.value.trim() || undefined,
            })
          }
          placeholder="날짜 (예: 2026.03.22 (일))"
          className="max-w-[180px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
        <input
          value={day.title ?? ""}
          onChange={(e) =>
            onDayChange({
              title: e.target.value.trim() || undefined,
            })
          }
          placeholder="제목 (선택)"
          className="min-w-[140px] flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={dayIndex === 0}
            onClick={onMoveDayUp}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
          >
            위로
          </button>
          <button
            type="button"
            disabled={dayIndex >= totalDays - 1}
            onClick={onMoveDayDown}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
          >
            아래로
          </button>
          <button
            type="button"
            onClick={onRemoveDay}
            className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] text-[var(--danger)] hover:opacity-90"
          >
            Day 삭제
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
          Day 커버 이미지 (선택, 카드 800px)
        </p>
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2">
            <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
              파일 업로드 / 드래그앤드롭
            </p>
            <ImageUploadField
              value={day.coverImageUrl ?? ""}
              onChange={(v) =>
                onDayChange({
                  coverImageUrl: v?.trim() || undefined,
                })
              }
              onUploaded={(v) =>
                onDayChange({
                  coverImageUrl: v?.trim() || undefined,
                })
              }
              uploadedUrlKey="card"
              optional
              placeholder="URL 또는 업로드"
            />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                상품 이미지에서 선택
              </p>
              {day.coverImageUrl ? (
                <button
                  type="button"
                  onClick={() => onDayChange({ coverImageUrl: undefined })}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  선택 해제
                </button>
              ) : null}
            </div>
            {productImageCandidates.length === 0 ? (
              <p className="rounded border border-dashed border-[var(--border)] bg-[var(--surface)] px-2 py-6 text-center text-[11px] text-[var(--text-muted)]">
                먼저 상품 이미지(여러 장)를 업로드해 주세요.
              </p>
            ) : (
              <div className="grid max-h-[240px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                {productImageCandidates.map((url, imageIndex) => {
                  const selected = (day.coverImageUrl ?? "").trim() === url;
                  return (
                    <button
                      key={`${url}-${imageIndex}`}
                      type="button"
                      onClick={() => onDayChange({ coverImageUrl: url })}
                      className={`group relative aspect-[4/3] overflow-hidden rounded-md border transition ${
                        selected
                          ? "border-[var(--primary)] ring-2 ring-[var(--primary-soft)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                      title={`이미지 ${imageIndex + 1} 선택`}
                    >
                      <img
                        src={normalizeProductImageUrl(url)}
                        alt={`상품 이미지 ${imageIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">이벤트</p>
        {events.map((ev, evIndex) => (
          <V2EventRow
            key={`ev-${dayIndex}-${evIndex}`}
            event={ev}
            eventIndex={evIndex}
            totalEvents={events.length}
            onEventChange={(patch) => onEventChange(evIndex, patch)}
            onMoveUp={() => onMoveEvent(evIndex, "up")}
            onMoveDown={() => onMoveEvent(evIndex, "down")}
            onRemove={() => onRemoveEvent(evIndex)}
            onSelect={onEventSelect ? () => onEventSelect(evIndex) : undefined}
            isSelected={
              selectedEvent?.editorType === "v2" &&
              selectedEvent.dayIndex === dayIndex &&
              selectedEvent.eventIndex === evIndex
            }
          />
        ))}
        <button
          type="button"
          onClick={onAddEvent}
          className="rounded border border-dashed border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 이벤트 추가
        </button>
      </div>
    </article>
  );
}
