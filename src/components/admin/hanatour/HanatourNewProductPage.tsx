"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { HanatourImportV1, HanatourImportWarning } from "@/types/hanatourImport";
import type { Product } from "@/types/product";
import type { SelectedEventRef } from "@/types/product";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { ProductFormState } from "@/types/adminProductForm";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";
import {
  isHanatourImportV1,
  validateHanatourImportV1,
  hanatourImportToDraft,
  mergeDraftOnlyEmpty,
  mergeHanatourImageHintsIntoV2Days,
} from "@/lib/admin/hanatourImport";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { validateImagePlacementState, groupImagePlacementIssuesByUrl } from "@/components/admin/modetour/modetourImageValidation";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import {
  PRODUCTS_LIST_PATH,
  buildImageNormalizeExtraWarnings,
  computeImageReviewSummary,
  logNormalizeImportStats,
  type NormalizeImportImageStats,
} from "@/components/admin/external-import/externalImportNewProduct.helpers";
import { useExternalImportImagePlacement } from "@/components/admin/external-import/useExternalImportImagePlacement";
import {
  ExternalImportPreviewSection,
  ExternalImportImageBatchPanel,
  ExternalImportDiffSummary,
  ExternalImportCreateProductSection,
  ExternalImportReviewToast,
} from "@/components/admin/external-import/ExternalImportNewProductShared";

export default function HanatourNewProductPage() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [importData, setImportData] = useState<HanatourImportV1 | null>(null);
  const [warnings, setWarnings] = useState<HanatourImportWarning[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappedDraft, setMappedDraft] = useState<ReturnType<typeof hanatourImportToDraft>["draft"] | null>(null);
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

  const imageReviewSummary = useMemo(
    () =>
      computeImageReviewSummary({
        formState,
        unassignedImageUrls,
        activeUnassignedImageUrls,
        unassignedDeletedNorm,
      }),
    [
      formState.image_url,
      formState.images_json,
      formState.itinerary_v2_json?.days,
      activeUnassignedImageUrls,
      unassignedImageUrls,
      unassignedDeletedNorm,
    ],
  );

  const diffSummary = useMemo(() => {
    const initial = initialFormSnapshotRef.current ?? formState;
    return getProductDiffSummary(initial, formState, {
      initialUnassignedCount: initialUnassignedCountRef.current,
      currentUnassignedCount: activeUnassignedImageUrls.length,
    });
  }, [formState, activeUnassignedImageUrls.length]);

  const {
    returnEventImageToUnassigned,
    removeUnassignedUrls,
    applyProductHeroUrl,
    recommendHeroFromHeuristic,
    assignUnassignedToSelectedEvent,
    assignUnassignedToDayFirstEvent,
    assignUnassignedToDayLastEvent,
    handleAutoAssignImages,
    handleDropOnEvent,
  } = useExternalImportImagePlacement({
    formState,
    setFormState,
    unassignedImageUrls,
    setUnassignedImageUrls,
    setUnassignedDeletedNorm,
    selectedEvent,
    setPreviewProduct,
    pushToast,
  });

  async function handleValidate() {
    setParseError(null);
    setPreviewError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    let parsed: HanatourImportV1;
    try {
      parsed = JSON.parse(jsonText) as HanatourImportV1;
    } catch {
      setParseError("JSON 파싱 실패");
      return;
    }

    if (!isHanatourImportV1(parsed)) {
      setParseError("HanatourImportV1 형식이 아닙니다.");
      return;
    }

    setIsNormalizingImages(true);
    let working = parsed;
    let normalizeStats: NormalizeImportImageStats | null = null;
    try {
      const res = await fetch("/api/admin/hanatour/normalize-import-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload: parsed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { payload: HanatourImportV1; stats: NormalizeImportImageStats };
        if (data.payload && isHanatourImportV1(data.payload)) {
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

    logNormalizeImportStats(normalizeStats);

    const result = validateHanatourImportV1(working);
    const { draft: patch, warnings: mapWarnings } = hanatourImportToDraft(working);

    const extraWarnings = buildImageNormalizeExtraWarnings(normalizeStats) as HanatourImportWarning[];

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
    const v2WithHints = mergeHanatourImageHintsIntoV2Days(
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
      <h1 className="text-xl font-semibold text-slate-100">상품 등록(하나)</h1>
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

            <ExternalImportPreviewSection previewProduct={previewProduct} />

            {/* 미할당 이미지 풀 + 일정 편집 (이미지 배치 DnD) */}
            <ExternalImportImageBatchPanel
              imagePlacementValidation={imagePlacementValidation}
              imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
              unassignedImageUrls={unassignedImageUrls}
              activeUnassignedImageUrls={activeUnassignedImageUrls}
              formState={formState}
              setFormState={setFormState}
              activeDayIndex={activeDayIndex}
              setActiveDayIndex={setActiveDayIndex}
              selectedEvent={selectedEvent}
              setSelectedEvent={setSelectedEvent}
              selectedEventSummary={selectedEventSummary}
              unassignedDeletedNorm={unassignedDeletedNorm}
              removeUnassignedUrls={removeUnassignedUrls}
              applyProductHeroUrl={applyProductHeroUrl}
              assignUnassignedToSelectedEvent={assignUnassignedToSelectedEvent}
              assignUnassignedToDayFirstEvent={assignUnassignedToDayFirstEvent}
              assignUnassignedToDayLastEvent={assignUnassignedToDayLastEvent}
              pushToast={pushToast}
              handleAutoAssignImages={handleAutoAssignImages}
              recommendHeroFromHeuristic={recommendHeroFromHeuristic}
              toggleUnassignedMarkedDeleted={toggleUnassignedMarkedDeleted}
              handleDropOnEvent={handleDropOnEvent}
              returnEventImageToUnassigned={returnEventImageToUnassigned}
            />

            {/* 저장 시 반영될 변경사항 요약 */}
            <ExternalImportDiffSummary
              show={Boolean(importData && previewProduct)}
              diffSummary={diffSummary}
            />

            {/* 상품 생성 액션 */}
            <ExternalImportCreateProductSection
              imageReviewSummary={imageReviewSummary}
              onCreateProduct={() => void handleCreateProduct()}
              canCreate={
                Boolean(importData) &&
                Boolean(previewProduct) &&
                !parseError &&
                !imagePlacementValidation.hasError
              }
              isSaving={isSaving}
              saveError={saveError}
              existingProductId={existingProductId}
              createdProductId={createdProductId}
            />
          </div>
        )}
      </div>

      <ExternalImportReviewToast reviewToast={reviewToast} />
    </div>
  );
}
