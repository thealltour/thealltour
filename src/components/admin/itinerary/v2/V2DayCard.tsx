"use client";

import type { ItineraryV2Day, ItineraryV2Event, SelectedEventRef } from "@/types/product";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";
import { ScheduleEditor } from "@/components/admin/product/schedule/ScheduleEditor";

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
  onCopyDay?: () => void;
  onCopyEvent?: (eventIndex: number) => void;
  onFocus?: () => void;
  selectedEvent?: SelectedEventRef | null;
  onEventSelect?: (eventIndex: number) => void;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "v2"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
  modetourImageReviewMode?: boolean;
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
  onCopyDay,
  onCopyEvent,
  onFocus,
  selectedEvent,
  onEventSelect,
  modetourDnDEnabled,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
  modetourImageReviewMode = false,
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
          {onCopyDay && (
            <button
              type="button"
              onClick={onCopyDay}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              Day 복사
            </button>
          )}
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
            disabled={totalDays <= 1}
            title={totalDays <= 1 ? "마지막 Day는 삭제할 수 없습니다." : undefined}
            className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] text-[var(--danger)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Day 삭제
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
          Day 커버 이미지 (선택, 카드 800px)
        </p>
        <HintDisclosure
          id="schedule.dayCoverImageGuide"
          summary="권장: 1200x800px 이상(3:2)"
        >
          {`지원 포맷: JPG, PNG, WebP
권장 사이즈: 1200x800px 이상 (3:2 비율). 카드/타임라인에서 800px 폭으로 사용되며, 비율이 맞으면 깨짐 없이 표시됩니다.`}
        </HintDisclosure>
        <div className="mt-2 flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
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
        <ScheduleEditor
          events={events}
          selectedEventIndex={
            selectedEvent?.editorType === "v2" &&
            selectedEvent.dayIndex === dayIndex
              ? selectedEvent.eventIndex
              : null
          }
          onSelectEvent={(evIndex) => onEventSelect?.(evIndex)}
          onEventChange={(evIndex, patch) => onEventChange(evIndex, patch)}
          onReorder={(nextEvents) => onDayChange({ events: nextEvents })}
          onAddEvent={onAddEvent}
          onRemoveEvent={(evIndex) => onRemoveEvent(evIndex)}
          onCopyEvent={onCopyEvent}
          modetourDnDEnabled={modetourDnDEnabled}
          dayIndex={dayIndex}
          onDropExternalImage={onDropExternalImage}
          onReturnImageToPool={onReturnImageToPool}
          imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
          showPlacementWarnings={showPlacementWarnings}
          modetourImageReviewMode={modetourImageReviewMode}
        />
      </div>
    </article>
  );
}
