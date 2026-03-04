"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItineraryV2Event } from "@/types/product";
import { GripVertical } from "lucide-react";

const ICON_LABELS: Record<string, string> = {
  car: "이동",
  utensils: "식사",
  golf: "골프",
  hotel: "숙소",
  map: "관광",
  sun: "자유",
};

export type EventListProps = {
  events: ItineraryV2Event[];
  selectedEventId: number | null;
  onSelect: (index: number) => void;
  onReorder: (events: ItineraryV2Event[]) => void;
  onAddEvent?: () => void;
};

function SortableEventItem({
  event,
  index,
  isSelected,
  onSelect,
}: {
  event: ItineraryV2Event;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `event-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const time = event.timeText?.trim() || event.timeOfDay || "";
  const iconLabel = event.iconKey ? ICON_LABELS[event.iconKey] ?? event.iconKey : "";
  const title = event.heading?.trim() || "(제목 없음)";
  const imageCount = event.images?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/40 ring-1 ring-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
      } ${isDragging ? "opacity-80 shadow-lg" : ""}`}
      onClick={() => onSelect(index)}
    >
      <button
        type="button"
        className="touch-manipulation shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        aria-label="드래그하여 순서 변경"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {time && (
            <span className="font-medium text-[var(--text-secondary)]">{time}</span>
          )}
          {iconLabel && (
            <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              {iconLabel}
            </span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={title}>
          {title}
        </p>
        {imageCount > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">{imageCount}장</p>
        )}
      </div>
    </div>
  );
}

export function EventList({
  events,
  selectedEventId,
  onSelect,
  onReorder,
  onAddEvent,
}: EventListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = events.findIndex((_, i) => `event-${i}` === active.id);
    const newIndex = events.findIndex((_, i) => `event-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(events, oldIndex, newIndex);
    onReorder(next);
    const newSelected =
      selectedEventId === oldIndex
        ? newIndex
        : selectedEventId === newIndex
          ? oldIndex
          : selectedEventId;
    if (newSelected !== null) onSelect(newSelected);
  };

  return (
    <div className="flex flex-col gap-2">
      {onAddEvent && (
        <button
          type="button"
          onClick={onAddEvent}
          className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 이벤트 추가
        </button>
      )}
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-6 text-center text-xs text-[var(--text-muted)]">
          이벤트가 없습니다.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={events.map((_, i) => `event-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1.5">
              {events.map((ev, i) => (
                <SortableEventItem
                  key={`ev-${i}-${ev.heading}`}
                  event={ev}
                  index={i}
                  isSelected={selectedEventId === i}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
