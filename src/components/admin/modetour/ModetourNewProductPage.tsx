"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import type { Product } from "@/types/product";
import type { SelectedEventRef } from "@/types/product";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { ProductFormState } from "@/types/adminProductForm";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";
import {
  isModetourImportV1,
  validateModetourImportV1,
  modetourImportToDraft,
  mergeDraftOnlyEmpty,
  mergeModetourImageHintsIntoV2Days,
} from "@/lib/admin/modetourImport";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { normalizeEventImages } from "@/components/admin/itinerary/shared/normalizeEventImages";
import {
  type ModetourImageDragItem,
  isValidImageDndPayload,
  isNoOpDrop,
} from "@/components/admin/modetour/modetourImageDnd";
import { validateImagePlacementState, groupImagePlacementIssuesByUrl } from "@/components/admin/modetour/modetourImageValidation";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { UnassignedImagePool } from "@/components/admin/modetour/UnassignedImagePool";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import {
  buildUnassignedDuplicateMeta,
  getImageHeuristicFlags,
  pickRecommendedHeroUrl,
} from "@/components/admin/modetour/modetourImageHeuristics";

const SNIPPET_LEN = 200;
const PRODUCTS_LIST_PATH = "/theall_manager_only/products";

function removeFirstMatch(arr: string[], url: string): string[] {
  const index = arr.indexOf(url);
  if (index === -1) return arr;
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

type EventImageObj = { url: string; alt?: string; sortOrder?: number; isCover?: boolean };

function insertImageAt(
  images: EventImageObj[],
  image: EventImageObj,
  insertAt: number,
): EventImageObj[] {
  const at = Math.max(0, Math.min(insertAt, images.length));
  return [...images.slice(0, at), image, ...images.slice(at)];
}

function removeImageAt(images: EventImageObj[], index: number): EventImageObj[] {
  if (index < 0 || index >= images.length) return images;
  return [...images.slice(0, index), ...images.slice(index + 1)];
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** target 이미지 배열에 이미 정규화된 url이 있는지 */
function targetHasUrl(images: EventImageObj[] | undefined, normalizedUrl: string): boolean {
  if (!normalizedUrl || !images?.length) return false;
  return images.some((img) => normalizeImageUrl(getEventImageUrl(img)) === normalizedUrl);
}

export default function ModetourNewProductPage() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [importData, setImportData] = useState<ModetourImportV1 | null>(null);
  const [warnings, setWarnings] = useState<ModetourImportWarning[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappedDraft, setMappedDraft] = useState<ReturnType<typeof modetourImportToDraft>["draft"] | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /** 편집용 form (일정/이미지 배치 반영). 검증 시 merged.form으로 초기화 */
  const [formState, setFormState] = useState<ProductFormState>(() => createEmptyProductFormState());
  /** 미할당 이미지 풀. 검증 시 importData.media?.unassignedImageUrls로 초기화 */
  const [unassignedImageUrls, setUnassignedImageUrls] = useState<string[]>([]);
  /** normalizeImageUrl 기준 — 저장 시 미할당에서 제외(삭제 예정) */
  const [unassignedDeletedNorm, setUnassignedDeletedNorm] = useState<Set<string>>(() => new Set());

  const toggleUnassignedMarkedDeleted = useCallback((norm: string) => {
    if (!norm) return;
    setUnassignedDeletedNorm((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) next.delete(norm);
      else next.add(norm);
      return next;
    });
  }, []);

  const activeUnassignedImageUrls = useMemo(
    () => unassignedImageUrls.filter((u) => !unassignedDeletedNorm.has(normalizeImageUrl(u))),
    [unassignedImageUrls, unassignedDeletedNorm],
  );

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isNormalizingImages, setIsNormalizingImages] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);
  const [reviewToast, setReviewToast] = useState<string | null>(null);

  const pushToast = useCallback((message: string) => {
    setReviewToast(message);
  }, []);

  useEffect(() => {
    if (!reviewToast) return;
    const t = window.setTimeout(() => setReviewToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [reviewToast]);

  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);
  const initialUnassignedCountRef = useRef<number>(0);

  const imagePlacementValidation = useMemo(
    () =>
      validateImagePlacementState({
        v2Days: formState.itinerary_v2_json?.days,
        structuredDays: formState.itinerary_days_json,
        unassignedImageUrls: activeUnassignedImageUrls,
      }),
    [formState.itinerary_v2_json?.days, formState.itinerary_days_json, activeUnassignedImageUrls],
  );

  const imagePlacementIssuesByUrl = useMemo(
    () => groupImagePlacementIssuesByUrl(imagePlacementValidation.issues),
    [imagePlacementValidation.issues],
  );

  const selectedEventSummary = useMemo(() => {
    if (!selectedEvent || selectedEvent.editorType !== "v2") return null;
    const day = formState.itinerary_v2_json?.days?.[selectedEvent.dayIndex];
    const ev = day?.events?.[selectedEvent.eventIndex];
    const title = ev?.heading?.trim() || "(제목 없음)";
    return `Day ${selectedEvent.dayIndex + 1} - ${title}`;
  }, [selectedEvent, formState.itinerary_v2_json?.days]);

  const imageReviewSummary = useMemo(() => {
    const v2 = formState.itinerary_v2_json?.days ?? [];
    let placedInEvents = 0;
    for (const d of v2) {
      for (const ev of d.events ?? []) {
        for (const img of ev.images ?? []) {
          if ((img as { status?: string }).status !== "deleted") placedInEvents += 1;
        }
      }
    }
    const hero = formState.image_url?.trim();
    const gallery = formState.images_json ?? [];
    const totalListed =
      (hero ? 1 : 0) + gallery.length + unassignedImageUrls.length + placedInEvents;
    const pool = [...(hero ? [hero] : []), ...gallery, ...activeUnassignedImageUrls];
    const dupMeta = buildUnassignedDuplicateMeta(pool);
    let dupSus = 0;
    for (const u of pool) {
      if ((dupMeta.urlToGroupSize.get(u) ?? 1) > 1) dupSus += 1;
    }
    const seenNorm = new Set<string>();
    let logoThumbSus = 0;
    for (const raw of pool) {
      const k = normalizeImageUrl(raw);
      if (!k || seenNorm.has(k)) continue;
      seenNorm.add(k);
      const f = getImageHeuristicFlags(raw);
      if (f.isLikelyLogo || f.isLikelyThumbnail) logoThumbSus += 1;
    }
    return {
      totalListed,
      unassigned: activeUnassignedImageUrls.length,
      unassignedDeletedPending: unassignedDeletedNorm.size,
      placedInEvents,
      hasHero: Boolean(hero),
      dupSus,
      logoThumbSus,
    };
  }, [
    formState.image_url,
    formState.images_json,
    formState.itinerary_v2_json?.days,
    activeUnassignedImageUrls,
    unassignedImageUrls,
    unassignedDeletedNorm,
  ]);

  const diffSummary = useMemo(() => {
    const initial = initialFormSnapshotRef.current ?? formState;
    return getProductDiffSummary(initial, formState, {
      initialUnassignedCount: initialUnassignedCountRef.current,
      currentUnassignedCount: activeUnassignedImageUrls.length,
    });
  }, [formState, activeUnassignedImageUrls.length]);

  async function handleValidate() {
    setParseError(null);
    setPreviewError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    let parsed: ModetourImportV1;
    try {
      parsed = JSON.parse(jsonText) as ModetourImportV1;
    } catch {
      setParseError("JSON 파싱 실패");
      return;
    }

    if (!isModetourImportV1(parsed)) {
      setParseError("ModetourImportV1 형식이 아닙니다.");
      return;
    }

    setIsNormalizingImages(true);
    type NormalizeStats = {
      uniqueUrls: number;
      attempted: number;
      uploaded: number;
      failed: number;
      skippedInternal: number;
      skipped: boolean;
      reason?: string;
    };
    let working = parsed;
    let normalizeStats: NormalizeStats | null = null;
    try {
      const res = await fetch("/api/admin/modetour/normalize-import-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload: parsed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { payload: ModetourImportV1; stats: NormalizeStats };
        if (data.payload && isModetourImportV1(data.payload)) {
          working = data.payload;
          normalizeStats = data.stats ?? null;
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.warn("[IMAGE][NORMALIZE_IMPORT_HTTP]", res.status, errBody);
      }
    } catch (e) {
      console.warn("[IMAGE][NORMALIZE_IMPORT_NETWORK]", e);
    } finally {
      setIsNormalizingImages(false);
    }

    if (normalizeStats && typeof console !== "undefined" && console.log) {
      const rate =
        normalizeStats.attempted > 0
          ? Math.round((normalizeStats.uploaded / normalizeStats.attempted) * 1000) / 10
          : null;
      console.log("[IMAGE][NORMALIZE_IMPORT_STATS]", {
        ...normalizeStats,
        successRatePercent: rate,
      });
    }

    const result = validateModetourImportV1(working);
    const { draft: patch, warnings: mapWarnings } = modetourImportToDraft(working);

    const extraWarnings: ModetourImportWarning[] = [];
    if (normalizeStats?.skipped && normalizeStats.reason === "missing_supabase_env") {
      extraWarnings.push({
        code: "IMAGE_REHOST_SKIPPED",
        message: "Supabase 서버 키/URL이 없어 이미지 정규화를 건너뛰었습니다.",
        path: "media",
      });
    } else if (
      normalizeStats &&
      !normalizeStats.skipped &&
      normalizeStats.uniqueUrls > 0 &&
      normalizeStats.failed > 0
    ) {
      extraWarnings.push({
        code: "IMAGE_REHOST_PARTIAL",
        message: `이미지 ${normalizeStats.failed}개 업로드 실패 — 해당 항목은 원본 URL을 유지했습니다.`,
        path: "media",
      });
    }

    setImportData(working);
    setWarnings([...result.warnings, ...mapWarnings, ...extraWarnings]);
    setMappedDraft(patch);

    const emptyForm = createEmptyProductFormState();
    const emptyDraft = { version: 1 as const, form: emptyForm, savedAt: 0 };
    const merged = mergeDraftOnlyEmpty(emptyDraft, patch);
    const hydrated = hydrateItineraryImages({
      v2Days: merged.form.itinerary_v2_json?.days,
      structuredDays: merged.form.itinerary_days_json,
      unassignedImageUrls: working.media?.unassignedImageUrls ?? [],
    });
    const v2WithHints = mergeModetourImageHintsIntoV2Days(
      hydrated.v2Days,
      working.media?.imageHintsByUrl,
    );
    setFormState({
      ...merged.form,
      itinerary_v2_json: { days: v2WithHints },
      itinerary_days_json: hydrated.structuredDays,
    });
    setUnassignedImageUrls(hydrated.unassignedImageUrls);
    setUnassignedDeletedNorm(new Set());
    initialFormSnapshotRef.current = structuredClone({
      ...merged.form,
      itinerary_v2_json: { days: v2WithHints },
      itinerary_days_json: hydrated.structuredDays,
    });
    initialUnassignedCountRef.current = hydrated.unassignedImageUrls.length;

    const imageUrl =
      merged.form.image_url?.trim() ||
      merged.form.images_json?.[0]?.trim() ||
      "";
    try {
      const product = formToPreviewProduct(merged.form, imageUrl);
      setPreviewProduct(product);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "미리보기 생성 실패");
    }
  }

  function handleReset() {
    setJsonText("");
    setImportData(null);
    setWarnings([]);
    setParseError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setPreviewError(null);
    setFormState(createEmptyProductFormState());
    setUnassignedImageUrls([]);
    setUnassignedDeletedNorm(new Set());
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);
    initialFormSnapshotRef.current = null;
  }

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

  async function handleCreateProduct() {
    if (!importData || !previewProduct) return;

    const validation = validateImagePlacementState({
      v2Days: formState.itinerary_v2_json?.days,
      structuredDays: formState.itinerary_days_json,
      unassignedImageUrls: activeUnassignedImageUrls,
    });
    if (validation.hasError) {
      const firstError = validation.errors[0];
      setSaveError(firstError?.message ?? "이미지 배치 오류가 있어 저장할 수 없습니다.");
      return;
    }

    const sourceUrl = importData.source?.url?.trim() ?? "";
    const formForSerialize: ProductFormState = {
      ...formState,
      product_source_url: sourceUrl || formState.product_source_url,
    };
    const payload = serializeAdminProductForm(formForSerialize, {
      unassignedImageUrls: activeUnassignedImageUrls,
    }) as Record<string, unknown>;

    // API 필수값 보정: 상품명·이미지 URL만 필수. 설명은 비어 있어도 생성 가능(편집에서 입력)
    const title =
      (payload.title as string)?.trim() ||
      importData.product?.title?.trim() ||
      previewProduct.title?.trim() ||
      "";
    const description =
      (payload.description as string)?.trim() ||
      importData.product?.summary?.trim() ||
      previewProduct.description?.trim() ||
      previewProduct.one_liner?.trim() ||
      "";
    const imageUrl =
      (payload.image_url as string)?.trim() ||
      importData.media?.heroImageUrl?.trim() ||
      (Array.isArray(importData.media?.galleryImageUrls) ? (importData.media.galleryImageUrls[0] as string) : undefined)?.trim() ||
      previewProduct.image_url?.trim() ||
      (Array.isArray(payload.images_json) ? (payload.images_json[0] as string) : undefined)?.trim() ||
      "";

    if (!title || !imageUrl) {
      setSaveError("상품명과 이미지 URL이 필요합니다. Import 데이터를 확인하세요.");
      return;
    }

    payload.title = title;
    payload.description = description || "";
    payload.image_url = imageUrl;

    setIsSaving(true);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        id?: string;
        existingId?: string;
      };

      if (response.status === 409) {
        setSaveError(result.message ?? "이미 같은 원본 URL로 생성된 상품이 있습니다.");
        setExistingProductId(result.existingId ?? null);
        return;
      }

      if (!response.ok) {
        setSaveError(result.message ?? "상품 생성에 실패했습니다.");
        return;
      }

      if (result.id) {
        setCreatedProductId(result.id);
        pushToast("상품이 생성되었습니다. 상품 목록으로 이동합니다.");
        router.push(
          `${PRODUCTS_LIST_PATH}?view=list&${ADMIN_PRODUCTS_QUERY_KEYS.CREATED}=${encodeURIComponent(result.id)}`,
        );
      }
    } catch {
      setSaveError("상품 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const dayCount = importData?.itinerary?.days?.length ?? 0;
  const eventCount =
    importData?.itinerary?.days?.reduce(
      (acc, day) => acc + (day.events?.length ?? 0),
      0,
    ) ?? 0;
  const imageCount =
    (importData?.media?.galleryImageUrls?.length ?? 0) +
    (importData?.media?.heroImageUrl ? 1 : 0);

  return (
    <div className="w-full px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold text-slate-100">상품 등록(모두)</h1>
      <p className="mt-2 text-sm text-slate-300">
        모두투어 상품 페이지에서 추출한 JSON을 붙여넣어 등록합니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        일정·이미지·기본 정보만 자동 반영됩니다. 설명/포함·불포함/예약·환불 규정은 편집에서 직접 입력해 주세요.
      </p>

      <div className="mt-6">
        <textarea
          className="h-48 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder:text-slate-500"
          placeholder="Chrome Extension에서 복사한 JSON을 붙여넣으세요"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={isNormalizingImages}
            onClick={() => void handleValidate()}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isNormalizingImages ? "이미지 정규화 중…" : "검증하기"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600"
          >
            초기화
          </button>
        </div>

        {parseError && (
          <div className="mt-4 text-red-400" role="alert">
            {parseError}
          </div>
        )}

        {previewError && (
          <div className="mt-4 text-amber-400" role="alert">
            미리보기: {previewError}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-yellow-400">검증 경고</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-200">
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  [{w.code}] {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importData && (
          <div className="mt-8 rounded-lg border border-slate-700 p-4">
            <h3 className="mb-3 font-semibold text-slate-200">Import 요약</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div>상품명: {importData.product?.title ?? "-"}</div>
              <div>
                여행 기간: {importData.product?.nights ?? "?"}박{" "}
                {importData.product?.days ?? "?"}일
              </div>
              <div>Day 수: {dayCount}</div>
              <div>이벤트 수: {eventCount}</div>
              <div>이미지 수: {imageCount}</div>
            </div>
          </div>
        )}

        {previewProduct && (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-5">
            <h3 className="mb-4 font-semibold text-slate-200">미리보기</h3>

            <div className="space-y-4 text-sm">
              <div>
                <span className="font-medium text-slate-400">제목</span>
                <p className="mt-0.5 text-slate-100">{previewProduct.title || "-"}</p>
              </div>

              {previewProduct.one_liner && (
                <div>
                  <span className="font-medium text-slate-400">요약</span>
                  <p className="mt-0.5 text-slate-300">{previewProduct.one_liner}</p>
                </div>
              )}

              {(previewProduct.overview_region || previewProduct.duration) && (
                <div className="flex flex-wrap gap-4">
                  {previewProduct.overview_region && (
                    <span className="text-slate-300">지역: {previewProduct.overview_region}</span>
                  )}
                  {previewProduct.duration && (
                    <span className="text-slate-300">기간: {previewProduct.duration}</span>
                  )}
                </div>
              )}

              {previewProduct.image_url && (
                <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg bg-slate-800">
                  <Image
                    src={normalizeProductImageUrl(previewProduct.image_url)}
                    alt={previewProduct.title || "대표 이미지"}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 672px"
                  />
                </div>
              )}

              {(previewProduct.included_items || previewProduct.excluded_items) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewProduct.included_items && (
                    <div>
                      <span className="font-medium text-slate-400">포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.included_items.length > SNIPPET_LEN
                          ? `${previewProduct.included_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.included_items}
                      </p>
                    </div>
                  )}
                  {previewProduct.excluded_items && (
                    <div>
                      <span className="font-medium text-slate-400">불포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.excluded_items.length > SNIPPET_LEN
                          ? `${previewProduct.excluded_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.excluded_items}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {previewProduct.terms_and_notes && (
                <div>
                  <span className="font-medium text-slate-400">약관/취소/유의사항</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                    {previewProduct.terms_and_notes.length > SNIPPET_LEN * 2
                      ? `${previewProduct.terms_and_notes.slice(0, SNIPPET_LEN * 2)}…`
                      : previewProduct.terms_and_notes}
                  </p>
                </div>
              )}

              {previewProduct.itinerary_v2_json?.days?.length ? (
                <div>
                  <span className="font-medium text-slate-400">일정</span>
                  <ul className="mt-2 space-y-3">
                    {previewProduct.itinerary_v2_json.days.map((day, index) => (
                      <li key={`day-${day.day}-${index}`} className="rounded border border-slate-700 bg-slate-800/50 p-3">
                        <div className="font-medium text-slate-200">
                          Day {day.day}
                          {day.title ? ` - ${day.title}` : ""}
                          {day.dateText ? ` (${day.dateText})` : ""}
                        </div>
                        <ul className="mt-2 space-y-1 pl-2 text-slate-400">
                          {(day.events ?? []).slice(0, 2).map((ev, i) => (
                            <li key={i}>
                              {ev.timeText ? `${ev.timeText} ` : ""}
                              {ev.heading || "(제목 없음)"}
                            </li>
                          ))}
                          {(day.events?.length ?? 0) > 2 && (
                            <li className="text-slate-500">… 외 {(day.events?.length ?? 0) - 2}개</li>
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* 미할당 이미지 풀 + 일정 편집 (이미지 배치 DnD) */}
            <div className="mt-8 space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <h3 className="font-semibold text-slate-200">일정 이미지 배치</h3>
              {imagePlacementValidation.issues.length > 0 && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    imagePlacementValidation.hasError
                      ? "border-red-800 bg-red-900/40 text-red-200"
                      : "border-amber-700 bg-amber-900/30 text-amber-200"
                  }`}
                  role="alert"
                >
                  {imagePlacementValidation.hasError ? (
                    <p className="font-medium">오류가 있어 저장할 수 없습니다.</p>
                  ) : (
                    <p className="font-medium">저장 전 확인해 주세요.</p>
                  )}
                  <p className="mt-0.5 text-xs opacity-90">
                    오류 {imagePlacementValidation.errors.length}건
                    {imagePlacementValidation.warnings.length > 0 &&
                      ` / 경고 ${imagePlacementValidation.warnings.length}건`}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs opacity-95">
                    {imagePlacementValidation.errors.slice(0, 5).map((e, i) => (
                      <li key={`e-${i}`}>{e.message}</li>
                    ))}
                    {imagePlacementValidation.warnings.slice(0, 3).map((w, i) => (
                      <li key={`w-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                미할당 이미지를 드래그하여 각 일정 이벤트에 배치할 수 있습니다. 이벤트에서 삭제 시 미할당 풀로 돌아갑니다.
              </p>
              <UnassignedImagePool
                imageUrls={unassignedImageUrls}
                title={`미할당 이미지 (${unassignedImageUrls.length}장 · 저장 반영 ${activeUnassignedImageUrls.length}장)`}
                className="mb-4"
                heroImageUrl={formState.image_url}
                issuesByUrl={imagePlacementIssuesByUrl}
                activeDayIndex={activeDayIndex}
                v2Days={formState.itinerary_v2_json?.days ?? []}
                selectedEvent={selectedEvent}
                selectedEventSummary={selectedEventSummary}
                onRemoveUrls={removeUnassignedUrls}
                onSetHero={applyProductHeroUrl}
                onAddToSelectedEvent={assignUnassignedToSelectedEvent}
                onAddToDayFirstEvent={assignUnassignedToDayFirstEvent}
                onAddToDayLastEvent={assignUnassignedToDayLastEvent}
                onToast={pushToast}
                onAutoAssignImages={handleAutoAssignImages}
                onRecommendHero={recommendHeroFromHeuristic}
                imageReviewMode
                markedDeletedNormUrls={unassignedDeletedNorm}
                onToggleMarkedDeleted={toggleUnassignedMarkedDeleted}
              />
              <ScheduleVisualEditorV2
                form={{
                  itinerary_v2_json: formState.itinerary_v2_json ?? { days: [] },
                  legacy_itinerary_text: formState.legacy_itinerary_text ?? "",
                  images_json: formState.images_json,
                  image_url: formState.image_url,
                }}
                setForm={(updater: React.SetStateAction<any>) => {
                  setFormState((prev) => {
                    const formSlice = {
                      itinerary_v2_json: prev.itinerary_v2_json ?? { days: [] },
                      legacy_itinerary_text: prev.legacy_itinerary_text ?? "",
                      images_json: prev.images_json,
                      image_url: prev.image_url,
                    };
                    const nextSlice =
                      typeof updater === "function" ? (updater as (p: typeof formSlice) => typeof formSlice)(formSlice) : updater;
                    return { ...prev, ...nextSlice };
                  });
                }}
                previewProductImageUrl={formState.image_url?.trim() || ""}
                activeDayIndex={activeDayIndex}
                setActiveDayIndex={setActiveDayIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                modetourDnDEnabled
                onDropExternalImage={handleDropOnEvent}
                onReturnImageToPool={(url) => {
                  returnEventImageToUnassigned({ url });
                  pushToast("이미지를 미할당 풀로 옮겼습니다.");
                }}
                imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
                showPlacementWarnings={true}
                onAutoAssignImages={handleAutoAssignImages}
                unassignedImageCount={activeUnassignedImageUrls.length}
                modetourSelectionSummary={selectedEventSummary}
                modetourImageReviewMode
              />
            </div>

            {/* 저장 시 반영될 변경사항 요약 */}
            {importData && previewProduct && diffSummary.changed && (
              <div
                className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3 text-sm text-slate-200"
                role="region"
                aria-label="저장 시 반영될 변경사항"
              >
                <p className="mb-2 font-semibold">저장 시 반영될 변경사항</p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-300">
                  {diffSummary.sections.flatMap((s) =>
                    s.items.map((item, i) => (
                      <li key={`${s.key}-${i}`}>{item}</li>
                    )),
                  )}
                </ul>
              </div>
            )}

            {/* 상품 생성 액션 */}
            <div className="mt-6 flex flex-col gap-4 border-t border-slate-700 pt-4">
              <div
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm text-slate-200"
                role="region"
                aria-label="이미지 검수 요약"
              >
                <p className="mb-2 font-semibold text-slate-100">이미지 검수 요약</p>
                <ul className="grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
                  <li>총 수집(대표+갤러리+미할당+일정 배치 합산): {imageReviewSummary.totalListed}장</li>
                  <li>현재 미할당(저장 반영): {imageReviewSummary.unassigned}장</li>
                  {imageReviewSummary.unassignedDeletedPending > 0 ? (
                    <li>미할당 삭제 예정: {imageReviewSummary.unassignedDeletedPending}장</li>
                  ) : null}
                  <li>일정 이벤트에 배치됨(삭제 예정 제외): {imageReviewSummary.placedInEvents}장</li>
                  <li>대표 이미지 지정: {imageReviewSummary.hasHero ? "예" : "아니오"}</li>
                  <li>중복 의심(동일 그룹 다건): {imageReviewSummary.dupSus}건</li>
                  <li>로고/썸네일 의심(URL 기준): {imageReviewSummary.logoThumbSus}건</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                자동 삭제·자동 정리는 하지 않습니다. 이벤트별 이미지에서 삭제 예정·미할당 이동을 선택하고, 저장 시
                반영됩니다.
              </p>
              <button
                type="button"
                onClick={handleCreateProduct}
                disabled={
                  !importData ||
                  !previewProduct ||
                  isSaving ||
                  !!parseError ||
                  imagePlacementValidation.hasError
                }
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "생성 중…" : "상품 생성"}
              </button>

              {saveError && (
                <div
                  className="rounded-lg border border-red-800 bg-red-900/50 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {saveError}
                  {existingProductId && (
                    <div className="mt-2">
                      <Link
                        href={`${PRODUCTS_LIST_PATH}?editingId=${existingProductId}`}
                        className="inline-block rounded border border-red-600 bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        기존 상품으로 이동
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {createdProductId && !saveError && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-200">
                  <p className="font-medium">생성 완료</p>
                  <p className="mt-1 text-slate-300">상품이 등록되었습니다.</p>
                  <div className="mt-3 flex gap-3">
                    <Link
                      href={`/products/${createdProductId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-sky-600 bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
                    >
                      미리보기
                    </Link>
                    <Link
                      href={`${PRODUCTS_LIST_PATH}?view=list&${ADMIN_PRODUCTS_QUERY_KEYS.CREATED}=${encodeURIComponent(createdProductId)}`}
                      className="rounded border border-emerald-600 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
                    >
                      상품 목록에서 보기
                    </Link>
                    <Link
                      href={`${PRODUCTS_LIST_PATH}?${ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID}=${encodeURIComponent(createdProductId)}`}
                      className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                    >
                      상품 편집으로 이동
                    </Link>
                    <Link
                      href={PRODUCTS_LIST_PATH}
                      className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                    >
                      상품 목록으로 이동
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[80] max-w-[min(90vw,420px)] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 shadow-lg"
          role="status"
        >
          {reviewToast}
        </div>
      )}
    </div>
  );
}
