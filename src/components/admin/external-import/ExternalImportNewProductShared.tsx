"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, SelectedEventRef } from "@/types/product";
import type { ProductFormState } from "@/types/adminProductForm";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { UnassignedImagePool } from "@/components/admin/modetour/UnassignedImagePool";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type {
  ImagePlacementIssue,
  IssuesByUrl,
} from "@/components/admin/modetour/modetourImageValidation";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";
import {
  PRODUCTS_LIST_PATH,
  SNIPPET_LEN,
  type ImageReviewSummary,
} from "./externalImportNewProduct.helpers";

type ImagePlacementValidation = {
  issues: ImagePlacementIssue[];
  hasError: boolean;
  errors: ImagePlacementIssue[];
  warnings: ImagePlacementIssue[];
};

type DiffSummary = {
  changed: boolean;
  sections: Array<{ key: string; items: string[] }>;
};

export function ExternalImportPreviewSection({ previewProduct }: { previewProduct: Product }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <span className="font-medium text-[var(--text-muted)]">제목</span>
        <p className="mt-0.5 text-[var(--text-primary)]">{previewProduct.title || "-"}</p>
      </div>

      {previewProduct.one_liner && (
        <div>
          <span className="font-medium text-[var(--text-muted)]">요약</span>
          <p className="mt-0.5 text-[var(--text-secondary)]">{previewProduct.one_liner}</p>
        </div>
      )}

      {(previewProduct.overview_region || previewProduct.duration) && (
        <div className="flex flex-wrap gap-4">
          {previewProduct.overview_region && (
            <span className="text-[var(--text-secondary)]">지역: {previewProduct.overview_region}</span>
          )}
          {previewProduct.duration && (
            <span className="text-[var(--text-secondary)]">기간: {previewProduct.duration}</span>
          )}
        </div>
      )}

      {previewProduct.image_url && (
        <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg bg-[var(--surface-muted)]">
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
              <span className="font-medium text-[var(--text-muted)]">포함</span>
              <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-secondary)]">
                {previewProduct.included_items.length > SNIPPET_LEN
                  ? `${previewProduct.included_items.slice(0, SNIPPET_LEN)}…`
                  : previewProduct.included_items}
              </p>
            </div>
          )}
          {previewProduct.excluded_items && (
            <div>
              <span className="font-medium text-[var(--text-muted)]">불포함</span>
              <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-secondary)]">
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
          <span className="font-medium text-[var(--text-muted)]">약관/취소/유의사항</span>
          <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-secondary)]">
            {previewProduct.terms_and_notes.length > SNIPPET_LEN * 2
              ? `${previewProduct.terms_and_notes.slice(0, SNIPPET_LEN * 2)}…`
              : previewProduct.terms_and_notes}
          </p>
        </div>
      )}

      {previewProduct.itinerary_v2_json?.days?.length ? (
        <div>
          <span className="font-medium text-[var(--text-muted)]">일정</span>
          <ul className="mt-2 space-y-3">
            {previewProduct.itinerary_v2_json.days.map((day, index) => (
              <li key={`day-${day.day}-${index}`} className="rounded border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="font-medium text-[var(--text-primary)]">
                  Day {day.day}
                  {day.title ? ` - ${day.title}` : ""}
                  {day.dateText ? ` (${day.dateText})` : ""}
                </div>
                <ul className="mt-2 space-y-1 pl-2 text-[var(--text-muted)]">
                  {(day.events ?? []).slice(0, 2).map((ev, i) => (
                    <li key={i}>
                      {ev.timeText ? `${ev.timeText} ` : ""}
                      {ev.heading || "(제목 없음)"}
                    </li>
                  ))}
                  {(day.events?.length ?? 0) > 2 && (
                    <li className="text-[var(--text-muted)]">… 외 {(day.events?.length ?? 0) - 2}개</li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ExternalImportImageBatchPanel({
  imagePlacementValidation,
  imagePlacementIssuesByUrl,
  unassignedImageUrls,
  activeUnassignedImageUrls,
  formState,
  setFormState,
  activeDayIndex,
  setActiveDayIndex,
  selectedEvent,
  setSelectedEvent,
  selectedEventSummary,
  unassignedDeletedNorm,
  removeUnassignedUrls,
  applyProductHeroUrl,
  assignUnassignedToSelectedEvent,
  assignUnassignedToDayFirstEvent,
  assignUnassignedToDayLastEvent,
  pushToast,
  handleAutoAssignImages,
  recommendHeroFromHeuristic,
  toggleUnassignedMarkedDeleted,
  handleDropOnEvent,
  returnEventImageToUnassigned,
}: {
  imagePlacementValidation: ImagePlacementValidation;
  imagePlacementIssuesByUrl: IssuesByUrl;
  unassignedImageUrls: string[];
  activeUnassignedImageUrls: string[];
  formState: ProductFormState;
  setFormState: Dispatch<SetStateAction<ProductFormState>>;
  activeDayIndex: number;
  setActiveDayIndex: Dispatch<SetStateAction<number>>;
  selectedEvent: SelectedEventRef | null;
  setSelectedEvent: Dispatch<SetStateAction<SelectedEventRef | null>>;
  selectedEventSummary: string | null;
  unassignedDeletedNorm: Set<string>;
  removeUnassignedUrls: (urls: string[]) => void;
  applyProductHeroUrl: (url: string) => void;
  assignUnassignedToSelectedEvent: (url: string) => void;
  assignUnassignedToDayFirstEvent: (url: string, dayIndex: number) => void;
  assignUnassignedToDayLastEvent: (url: string, dayIndex: number) => void;
  pushToast: (message: string) => void;
  handleAutoAssignImages: () => void;
  recommendHeroFromHeuristic: () => void;
  toggleUnassignedMarkedDeleted: (norm: string) => void;
  handleDropOnEvent: (
    payload: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    },
  ) => void;
  returnEventImageToUnassigned: (params: { url: string }) => void;
}) {
  return (
    <div className="mt-8 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <h3 className="font-semibold text-[var(--text-primary)]">일정 이미지 배치</h3>
      {imagePlacementValidation.issues.length > 0 && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            imagePlacementValidation.hasError
              ? "border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]"
              : "border-[var(--warning)] bg-[var(--warning-bg)] text-[var(--warning)]"
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
      <p className="text-xs text-[var(--text-muted)]">
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
        setForm={(updater: SetStateAction<any>) => {
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
  );
}

export function ExternalImportDiffSummary({
  show,
  diffSummary,
}: {
  show: boolean;
  diffSummary: DiffSummary;
}) {
  if (!show || !diffSummary.changed) return null;
  return (
    <div
      className="rounded-lg border border-[var(--success)]/50 bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--text-primary)]"
      role="region"
      aria-label="저장 시 반영될 변경사항"
    >
      <p className="mb-2 font-semibold">저장 시 반영될 변경사항</p>
      <ul className="list-inside list-disc space-y-0.5 text-[var(--text-secondary)]">
        {diffSummary.sections.flatMap((s) =>
          s.items.map((item, i) => (
            <li key={`${s.key}-${i}`}>{item}</li>
          )),
        )}
      </ul>
    </div>
  );
}

export function ExternalImportCreateProductSection({
  imageReviewSummary,
  onCreateProduct,
  canCreate,
  isSaving,
  saveError,
  existingProductId,
  createdProductId,
}: {
  imageReviewSummary: ImageReviewSummary;
  onCreateProduct: () => void;
  canCreate: boolean;
  isSaving: boolean;
  saveError: string | null;
  existingProductId: string | null;
  createdProductId: string | null;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-[var(--border)] pt-4">
      <div
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]"
        role="region"
        aria-label="이미지 검수 요약"
      >
        <p className="mb-2 font-semibold text-[var(--text-primary)]">이미지 검수 요약</p>
        <ul className="grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
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
      <p className="text-xs text-[var(--text-muted)]">
        자동 삭제·자동 정리는 하지 않습니다. 이벤트별 이미지에서 삭제 예정·미할당 이동을 선택하고, 저장 시
        반영됩니다.
      </p>
      <button
        type="button"
        onClick={onCreateProduct}
        disabled={!canCreate || isSaving}
        className="rounded-lg border border-[var(--success)] bg-[var(--success)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "생성 중…" : "상품 생성"}
      </button>

      {saveError && (
        <div
          className="rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {saveError}
          {existingProductId && (
            <div className="mt-2">
              <Link
                href={`${PRODUCTS_LIST_PATH}?editingId=${existingProductId}`}
                className="inline-block rounded border border-[var(--danger)] bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                기존 상품으로 이동
              </Link>
            </div>
          )}
        </div>
      )}

      {createdProductId && !saveError && (
        <div className="rounded-lg border border-[var(--success)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          <p className="font-medium">생성 완료</p>
          <p className="mt-1 text-[var(--text-secondary)]">상품이 등록되었습니다.</p>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/products/${createdProductId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              미리보기
            </Link>
            <Link
              href={`${PRODUCTS_LIST_PATH}?view=list&${ADMIN_PRODUCTS_QUERY_KEYS.CREATED}=${encodeURIComponent(createdProductId)}`}
              className="rounded border border-[var(--success)] bg-[var(--success)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              상품 목록에서 보기
            </Link>
            <Link
              href={`${PRODUCTS_LIST_PATH}?${ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID}=${encodeURIComponent(createdProductId)}`}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              상품 편집으로 이동
            </Link>
            <Link
              href={PRODUCTS_LIST_PATH}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              상품 목록으로 이동
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExternalImportReviewToast({ reviewToast }: { reviewToast: string | null }) {
  if (!reviewToast) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[80] max-w-[min(90vw,420px)] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-sm text-[var(--text-primary)] shadow-lg"
      role="status"
    >
      {reviewToast}
    </div>
  );
}
