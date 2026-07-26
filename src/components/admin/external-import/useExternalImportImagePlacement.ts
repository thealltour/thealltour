import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import type { Product, SelectedEventRef } from "@/types/product";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { normalizeEventImages } from "@/components/admin/itinerary/shared/normalizeEventImages";
import {
  type ModetourImageDragItem,
  isValidImageDndPayload,
  isNoOpDrop,
} from "@/components/admin/modetour/modetourImageDnd";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { pickRecommendedHeroUrl } from "@/components/admin/modetour/modetourImageHeuristics";
import {
  arrayMove,
  insertImageAt,
  removeFirstMatch,
  removeImageAt,
  targetHasUrl,
  type EventImageObj,
} from "./externalImportNewProduct.helpers";

type UseExternalImportImagePlacementParams = {
  formState: ProductFormState;
  setFormState: Dispatch<SetStateAction<ProductFormState>>;
  unassignedImageUrls: string[];
  setUnassignedImageUrls: Dispatch<SetStateAction<string[]>>;
  setUnassignedDeletedNorm: Dispatch<SetStateAction<Set<string>>>;
  selectedEvent: SelectedEventRef | null;
  setPreviewProduct: Dispatch<SetStateAction<Product | null>>;
  pushToast: (message: string) => void;
};

export function useExternalImportImagePlacement({
  formState,
  setFormState,
  unassignedImageUrls,
  setUnassignedImageUrls,
  setUnassignedDeletedNorm,
  selectedEvent,
  setPreviewProduct,
  pushToast,
}: UseExternalImportImagePlacementParams) {
  function assignUnassignedImageToEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    url: string;
    insertAt?: number;
  }) {
    const { editorType, dayIndex, eventIndex, url, insertAt } = params;
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl) return;

    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (targetHasUrl(images, normalizedUrl)) return prev;
        const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
        let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
        nextImages = dedupeEventImages(nextImages);
        const normalized = normalizeEventImages(nextImages);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
        };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (targetHasUrl(images, normalizedUrl)) return prev;
      const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
      let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
      nextImages = dedupeEventImages(nextImages);
      const normalized = normalizeEventImages(nextImages);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
    setUnassignedImageUrls((prev) => removeFirstMatch(prev, url));
  }

  function returnEventImageToUnassigned(params: { url: string }) {
    setUnassignedImageUrls((prev) => [...prev, params.url]);
  }

  function removeUnassignedUrls(urls: string[]) {
    if (urls.length === 0) return;
    const drop = new Set(urls.map((u) => normalizeImageUrl(u)).filter(Boolean));
    setUnassignedImageUrls((prev) => prev.filter((u) => !drop.has(normalizeImageUrl(u))));
    setUnassignedDeletedNorm((prev) => {
      const next = new Set(prev);
      for (const k of drop) next.delete(k);
      return next;
    });
  }

  function applyProductHeroUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFormState((prev) => {
      const imgs = [...(prev.images_json ?? [])];
      const n = normalizeImageUrl(trimmed);
      const ix = imgs.findIndex((x) => normalizeImageUrl(x) === n);
      if (ix > 0) {
        const [it] = imgs.splice(ix, 1);
        imgs.unshift(it!);
      } else if (ix === -1) {
        imgs.unshift(trimmed);
      }
      const next: ProductFormState = { ...prev, image_url: trimmed, images_json: imgs };
      const imageUrl = next.image_url?.trim() || next.images_json?.[0]?.trim() || "";
      try {
        setPreviewProduct(formToPreviewProduct(next, imageUrl));
      } catch {
        /* ignore preview sync errors */
      }
      return next;
    });
  }

  function recommendHeroFromHeuristic() {
    const pool = [
      formState.image_url,
      ...(formState.images_json ?? []),
      ...unassignedImageUrls,
    ].filter((x): x is string => Boolean(x?.trim()));
    const best = pickRecommendedHeroUrl(pool);
    if (best) {
      applyProductHeroUrl(best);
      pushToast("추천 규칙으로 대표 이미지를 반영했습니다.");
    } else {
      pushToast("추천할 대표 이미지 후보가 없습니다.");
    }
  }

  function assignUnassignedToSelectedEvent(url: string) {
    if (!selectedEvent || selectedEvent.editorType !== "v2") return;
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex: selectedEvent.dayIndex,
      eventIndex: selectedEvent.eventIndex,
      url,
    });
  }

  function assignUnassignedToDayFirstEvent(url: string, dayIndex: number) {
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex,
      eventIndex: 0,
      url,
    });
  }

  function assignUnassignedToDayLastEvent(url: string, dayIndex: number) {
    const events = formState.itinerary_v2_json?.days?.[dayIndex]?.events ?? [];
    const last = Math.max(0, events.length - 1);
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex,
      eventIndex: last,
      url,
    });
  }

  function handleAutoAssignImages() {
    const days = formState.itinerary_v2_json?.days ?? [];
    const unassigned = [...unassignedImageUrls];
    let uIndex = 0;
    const nextDays = days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const hasImages = (ev.images?.length ?? 0) > 0;
        if (hasImages || uIndex >= unassigned.length) return ev;
        const url = unassigned[uIndex];
        uIndex += 1;
        const newImages = normalizeEventImages([{ url, sortOrder: 0, isCover: true }]);
        const merged = dedupeEventImages([...(ev.images ?? []), ...newImages]);
        return { ...ev, images: normalizeEventImages(merged) };
      }),
    }));
    const consumed = uIndex;
    setFormState((prev) => ({
      ...prev,
      itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
    }));
    setUnassignedImageUrls((prev) => prev.slice(consumed));
  }

  function reorderWithinEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    fromIndex: number;
    toIndex: number;
  }) {
    const { editorType, dayIndex, eventIndex, fromIndex, toIndex } = params;
    if (fromIndex === toIndex) return;
    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
          return prev;
        const reordered = arrayMove(images, fromIndex, toIndex);
        const normalized = normalizeEventImages(reordered);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
        return prev;
      const reordered = arrayMove(images, fromIndex, toIndex);
      const normalized = normalizeEventImages(reordered);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
  }

  function moveImageBetweenEvents(params: {
    sourceEditorType: "v2" | "structured";
    sourceDayIndex: number;
    sourceEventIndex: number;
    sourceImageIndex: number;
    targetEditorType: "v2" | "structured";
    targetDayIndex: number;
    targetEventIndex: number;
    targetInsertAt: number;
  }) {
    const {
      sourceEditorType,
      sourceDayIndex,
      sourceEventIndex,
      sourceImageIndex,
      targetEditorType,
      targetDayIndex,
      targetEventIndex,
      targetInsertAt,
    } = params;

    setFormState((prev) => {
      const getSourceImages = (): EventImageObj[] | null => {
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[sourceDayIndex];
          const event = day?.events?.[sourceEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[sourceDayIndex];
        const event = day?.events?.[sourceEventIndex];
        return event?.images ?? null;
      };
      const getTargetImages = (): EventImageObj[] | null => {
        if (targetEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[targetDayIndex];
          const event = day?.events?.[targetEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[targetDayIndex];
        const event = day?.events?.[targetEventIndex];
        return event?.images ?? null;
      };

      const sourceImages = getSourceImages();
      const targetImages = getTargetImages();
      if (!sourceImages || sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length)
        return prev;
      const imageToMove = sourceImages[sourceImageIndex];
      if (!imageToMove) return prev;

      const movedUrl = normalizeImageUrl(imageToMove.url);
      const afterRemove = removeImageAt(sourceImages, sourceImageIndex);
      const targetBase = targetImages ?? [];
      const insertAt = Math.max(0, Math.min(targetInsertAt, targetBase.length));

      if (targetHasUrl(targetBase, movedUrl)) {
        const normalizedSource = normalizeEventImages(afterRemove);
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const nextDays = days.map((d, i) =>
            i === sourceDayIndex
              ? {
                  ...d,
                  events: (d.events ?? []).map((e, ei) =>
                    ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                  ),
                }
              : d,
          );
          return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
        }
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        return { ...prev, itinerary_days_json: nextDays };
      }

      let afterInsert = insertImageAt(targetBase, imageToMove, insertAt);
      afterInsert = dedupeEventImages(afterInsert);
      const normalizedSource = normalizeEventImages(afterRemove);
      const normalizedTarget = normalizeEventImages(afterInsert);

      if (sourceEditorType === "v2" && targetEditorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }

      if (sourceEditorType === "structured" && targetEditorType === "structured") {
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_days_json: nextDays };
      }

      if (sourceEditorType === "v2" && targetEditorType === "structured") {
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const structDays = prev.itinerary_days_json ?? [];
        const nextV2Days = v2Days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextStructDays = structDays.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
          itinerary_days_json: nextStructDays,
        };
      }

      if (sourceEditorType === "structured" && targetEditorType === "v2") {
        const structDays = prev.itinerary_days_json ?? [];
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const nextStructDays = structDays.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextV2Days = v2Days.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_days_json: nextStructDays,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
        };
      }

      return prev;
    });
  }

  function handleDropOnEvent(
    payload: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    },
  ) {
    if (!payload || !isValidImageDndPayload(payload)) return;
    const normalizedUrl = normalizeImageUrl(payload.url);
    if (!normalizedUrl) return;

    const destEditorType = destination.editorType;
    const destDayIndex = destination.dayIndex;
    const destEventIndex = destination.eventIndex;
    const destInsertAt =
      destination.insertAt != null
        ? Math.max(0, destination.insertAt)
        : (() => {
            const days =
              destEditorType === "v2"
                ? formState.itinerary_v2_json?.days
                : formState.itinerary_days_json;
            const day = days?.[destDayIndex];
            const images = day?.events?.[destEventIndex]?.images ?? [];
            return images.length;
          })();

    const destDays = destEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
    const destDay = destDays?.[destDayIndex];
    const destEvent = destDay?.events?.[destEventIndex];
    if (!destDay || !destEvent) return;

    if (payload.source === "unassigned") {
      if (targetHasUrl(destEvent.images ?? [], normalizedUrl)) {
        setUnassignedImageUrls((prev) => removeFirstMatch(prev, payload.url));
        pushToast("이미 해당 이벤트에 있는 이미지라 미할당 풀에서만 제거했습니다.");
      } else {
        assignUnassignedImageToEvent({
          editorType: destEditorType,
          dayIndex: destDayIndex,
          eventIndex: destEventIndex,
          url: payload.url,
          insertAt: destInsertAt,
        });
        pushToast(`이미지를 Day ${destDayIndex + 1} 이벤트에 추가했습니다.`);
      }
      return;
    }

    if (payload.source === "event") {
      const sourceEditorType = payload.editorType;
      const sourceDayIndex = payload.dayIndex;
      const sourceEventIndex = payload.eventIndex;
      const sourceImageIndex = payload.imageIndex;
      const sourceDays = sourceEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
      const sourceDay = sourceDays?.[sourceDayIndex];
      const sourceEvent = sourceDay?.events?.[sourceEventIndex];
      const sourceImages = sourceEvent?.images ?? [];
      if (!sourceDay || !sourceEvent) return;
      if (sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length) return;

      const sameEvent =
        sourceEditorType === destEditorType &&
        sourceDayIndex === destDayIndex &&
        sourceEventIndex === destEventIndex;

      if (sameEvent) {
        if (
          isNoOpDrop({
            source: {
              editorType: sourceEditorType,
              dayIndex: sourceDayIndex,
              eventIndex: sourceEventIndex,
              imageIndex: sourceImageIndex,
            },
            target: {
              editorType: destEditorType,
              dayIndex: destDayIndex,
              eventIndex: destEventIndex,
              insertAt: destInsertAt,
            },
            sourceImagesLength: sourceImages.length,
          })
        )
          return;
        const fromIndex = sourceImageIndex;
        let toIndex = destInsertAt;
        if (toIndex > fromIndex) toIndex -= 1;
        if (fromIndex === toIndex) return;
        reorderWithinEvent({
          editorType: sourceEditorType,
          dayIndex: sourceDayIndex,
          eventIndex: sourceEventIndex,
          fromIndex,
          toIndex,
        });
      } else {
        moveImageBetweenEvents({
          sourceEditorType,
          sourceDayIndex,
          sourceEventIndex,
          sourceImageIndex,
          targetEditorType: destEditorType,
          targetDayIndex: destDayIndex,
          targetEventIndex: destEventIndex,
          targetInsertAt: destInsertAt,
        });
      }
    }
  }

  return {
    assignUnassignedImageToEvent,
    returnEventImageToUnassigned,
    removeUnassignedUrls,
    applyProductHeroUrl,
    recommendHeroFromHeuristic,
    assignUnassignedToSelectedEvent,
    assignUnassignedToDayFirstEvent,
    assignUnassignedToDayLastEvent,
    handleAutoAssignImages,
    reorderWithinEvent,
    moveImageBetweenEvents,
    handleDropOnEvent,
  };
}
