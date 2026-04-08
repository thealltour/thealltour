"use client";

import type { ItineraryV2Event } from "@/types/product";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";
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
  onCopyEvent?: (eventIndex: number) => void;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  dayIndex?: number;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "v2"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
  modetourImageReviewMode?: boolean;
};

export function ScheduleEditor({
  events,
  selectedEventIndex,
  onSelectEvent,
  onEventChange,
  onReorder,
  onAddEvent,
  onRemoveEvent,
  onCopyEvent,
  modetourDnDEnabled,
  dayIndex = 0,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
  modetourImageReviewMode = false,
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
          onCopy={
            onCopyEvent != null && selectedEventIndex != null
              ? () => onCopyEvent(selectedEventIndex)
              : undefined
          }
          modetourDnDEnabled={modetourDnDEnabled}
          dayIndex={dayIndex}
          eventIndex={selectedEventIndex ?? 0}
          onDropExternalImage={onDropExternalImage}
          onReturnImageToPool={onReturnImageToPool}
          imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
          showPlacementWarnings={showPlacementWarnings}
          modetourImageReviewMode={modetourImageReviewMode}
        />
      </div>
    </div>
  );
}
