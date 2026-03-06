/**
 * 모두투어 Import 화면: 미할당 이미지 ↔ 이벤트 이미지 Drag & Drop payload.
 * HTML5 dataTransfer에 문자열로 저장/복원.
 * - source:"unassigned" → 미할당 풀에서 드래그
 * - source:"event" → 이벤트 간 이동/같은 이벤트 reorder (PR8.8)
 */

export type ModetourImageDragItem =
  | {
      source: "unassigned";
      url: string;
    }
  | {
      source: "event";
      url: string;
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      imageIndex: number;
    };

const DND_TYPE = "application/x-modetour-image-drag";

export function toDragData(item: ModetourImageDragItem): string {
  return JSON.stringify(item);
}

export function fromDragData(data: string | null): ModetourImageDragItem | null {
  if (!data?.trim()) return null;
  try {
    const parsed = JSON.parse(data) as ModetourImageDragItem;
    if (parsed.source === "unassigned" && typeof parsed.url === "string") return parsed;
    if (
      parsed.source === "event" &&
      typeof parsed.url === "string" &&
      (parsed.editorType === "v2" || parsed.editorType === "structured") &&
      typeof parsed.dayIndex === "number" &&
      typeof parsed.eventIndex === "number" &&
      typeof parsed.imageIndex === "number"
    )
      return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setDragData(dataTransfer: DataTransfer, item: ModetourImageDragItem): void {
  dataTransfer.setData(DND_TYPE, toDragData(item));
  dataTransfer.setData("text/plain", toDragData(item));
}

export function getDragData(dataTransfer: DataTransfer): ModetourImageDragItem | null {
  const raw = dataTransfer.getData(DND_TYPE) || dataTransfer.getData("text/plain");
  return fromDragData(raw);
}
