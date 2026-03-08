/**
 * 모두투어 Import 화면: 미할당 이미지 ↔ 이벤트 이미지 Drag & Drop payload.
 * PR8.10: URL 정규화는 @/lib/images/normalizeImageUrl 사용.
 */

import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";

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

/** DnD payload 타입 별칭 (validation/guard에서 사용) */
export type ImageDndPayload = ModetourImageDragItem;

const DND_TYPE = "application/x-modetour-image-drag";

/**
 * raw 문자열을 파싱해 유효한 payload면 반환, 아니면 null.
 */
export function parseImageDndPayload(raw: string | null | undefined): ImageDndPayload | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isValidImageDndPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Type guard: payload가 유효한 ImageDndPayload인지 검사.
 */
export function isValidImageDndPayload(payload: unknown): payload is ImageDndPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const o = payload as Record<string, unknown>;
  const source = o.source;
  const url = o.url;
  if (source !== "unassigned" && source !== "event") return false;
  if (typeof url !== "string" || !normalizeImageUrl(url).length) return false;

  if (source === "unassigned") {
    if ("imageIndex" in o && o.imageIndex !== undefined && !Number.isFinite(Number(o.imageIndex)))
      return false;
    return true;
  }

  return (
    (o.editorType === "v2" || o.editorType === "structured") &&
    Number.isFinite(Number(o.dayIndex)) &&
    Number.isFinite(Number(o.eventIndex)) &&
    Number.isFinite(Number(o.imageIndex))
  );
}

export function toDragData(item: ModetourImageDragItem): string {
  return JSON.stringify(item);
}

export function fromDragData(data: string | null): ModetourImageDragItem | null {
  const raw = data?.trim() ?? null;
  return parseImageDndPayload(raw);
}

export function setDragData(dataTransfer: DataTransfer, item: ModetourImageDragItem): void {
  dataTransfer.setData(DND_TYPE, toDragData(item));
  dataTransfer.setData("text/plain", toDragData(item));
}

export function getDragData(dataTransfer: DataTransfer): ModetourImageDragItem | null {
  const raw = dataTransfer.getData(DND_TYPE) || dataTransfer.getData("text/plain");
  return fromDragData(raw);
}

/** 같은 event 내 같은 위치(결과적으로 순서 변화 없음)인지 */
export function isSameImagePosition(
  source: { editorType: "v2" | "structured"; dayIndex: number; eventIndex: number; imageIndex: number },
  target: { editorType: "v2" | "structured"; dayIndex: number; eventIndex: number; insertAt: number },
): boolean {
  if (
    source.editorType !== target.editorType ||
    source.dayIndex !== target.dayIndex ||
    source.eventIndex !== target.eventIndex
  )
    return false;
  const toIndex = target.insertAt;
  const fromIndex = source.imageIndex;
  if (fromIndex === toIndex || fromIndex === toIndex - 1) return true;
  return false;
}

/** no-op drop 여부: source와 target이 동일 event이고, 삽입 후 순서가 사실상 동일한 경우 */
export function isNoOpDrop(params: {
  source: { editorType: "v2" | "structured"; dayIndex: number; eventIndex: number; imageIndex: number };
  target: { editorType: "v2" | "structured"; dayIndex: number; eventIndex: number; insertAt: number };
  sourceImagesLength: number;
}): boolean {
  const { source, target, sourceImagesLength } = params;
  if (
    source.editorType !== target.editorType ||
    source.dayIndex !== target.dayIndex ||
    source.eventIndex !== target.eventIndex
  )
    return false;
  const fromIndex = source.imageIndex;
  let toIndex = target.insertAt;
  if (toIndex > fromIndex) toIndex -= 1;
  if (fromIndex === toIndex) return true;
  if (sourceImagesLength <= 1) return true;
  return false;
}
