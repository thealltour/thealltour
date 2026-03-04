"use client";

import type { ItineraryV2Event } from "@/types/product";
import { EventList } from "./EventList";
import { EventEditor } from "./EventEditor";

export type ScheduleEditorProps = {
  events: ItineraryV2Event[];
  selectedEventIndex: number | null;
  onSelectEvent: (index: number) => void;
  onEventChange: (index: number, patch: Partial<ItineraryV2Event>) => void;
  onReorder: (events: ItineraryV2Event[]) => void;
  onAddEvent: () => void;
  onRemoveEvent: (index: number) => void;
};

export function ScheduleEditor({
  events,
  selectedEventIndex,
  onSelectEvent,
  onEventChange,
  onReorder,
  onAddEvent,
  onRemoveEvent,
}: ScheduleEditorProps) {
  const selectedEvent =
    selectedEventIndex != null && events[selectedEventIndex] != null
      ? events[selectedEventIndex]
      : null;

  const handleAddEvent = () => {
    onAddEvent();
    const nextIndex = events.length;
    onSelectEvent(nextIndex);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">이벤트 목록</p>
        <EventList
          events={events}
          selectedEventId={selectedEventIndex}
          onSelect={onSelectEvent}
          onReorder={onReorder}
          onAddEvent={handleAddEvent}
        />
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">이벤트 편집</p>
        <EventEditor
          event={selectedEvent}
          onChange={
            selectedEventIndex != null
              ? (patch) => onEventChange(selectedEventIndex, patch)
              : () => {}
          }
          onRemove={
            selectedEventIndex != null
              ? () => onRemoveEvent(selectedEventIndex)
              : undefined
          }
        />
      </div>
    </div>
  );
}
