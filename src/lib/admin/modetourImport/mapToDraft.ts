import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ProductFormState, ProductFormDraft } from "@/types/adminProductForm";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import { createEmptyProductFormState } from "@/types/adminProductForm";

// PR16 정책: Modetour import는 설명/포함·불포함/약관 데이터를 자동 주입하지 않는다.
// 운영자가 관리자 편집 화면에서 직접 작성하도록 한다. (일정·이미지·기본 정보만 자동 반영)

/** Import → Draft 변환 결과 (빈 필드만 채우는 merge용 patch) */
export function modetourImportToDraft(input: ModetourImportV1): {
  draft: { version: 1; form: Partial<ProductFormState>; savedAt: number };
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];
  const form: Partial<ProductFormState> = {};

  if (input.product?.title?.trim()) {
    form.title = input.product.title.trim();
  }
  if (input.product?.nights != null || input.product?.days != null) {
    const n = input.product.nights ?? 0;
    const d = input.product.days ?? 0;
    form.duration = n > 0 || d > 0 ? `${n}박${d}일` : "";
    form.overview_duration = form.duration;
  }
  if (input.product?.regionText?.trim()) {
    form.overview_region = input.product.regionText.trim();
    form.theme = input.product.regionText.trim();
  }
  if (input.product?.priceText?.trim()) {
    form.price_meta = input.product.priceText.trim();
    const numMatch = input.product.priceText.replace(/\D/g, "");
    if (numMatch) {
      const num = parseInt(numMatch, 10);
      if (!Number.isNaN(num)) form.price = String(num);
    }
  }

  if (input.source?.url?.trim()) {
    form.product_source_url = input.source.url.trim();
  }

  if (input.media?.heroImageUrl?.trim()) {
    form.image_url = input.media.heroImageUrl.trim();
  }
  if (input.media?.galleryImageUrls?.length) {
    form.images_json = input.media.galleryImageUrls.filter((u) => u?.trim());
  }
  if (input.media?.unassignedImageUrls?.length) {
    warnings.push({
      code: "UNASSIGNED_IMAGES",
      message: `미할당 이미지 ${input.media.unassignedImageUrls.length}장은 draft에 반영되지 않습니다.`,
      path: "media.unassignedImageUrls",
    });
  }

  if (input.itinerary?.days?.length) {
    const days: ItineraryV2Day[] = input.itinerary.days.map((d) => {
      const events: ItineraryV2Event[] = (d.events ?? []).map((ev) => ({
        order: ev.order,
        timeText: ev.timeText?.trim() || undefined,
        heading: ev.title?.trim() ?? "",
        description: ev.descriptionText?.trim() || undefined,
        iconKey: undefined,
        images: ev.imageUrls?.length
          ? ev.imageUrls.map((url, i) => ({ url: url.trim(), sortOrder: i, isCover: i === 0 }))
          : undefined,
      }));
      return {
        day: d.dayNumber,
        title: d.title?.trim() || undefined,
        dateText: d.dateText?.trim() || undefined,
        coverImageUrl: d.imageUrls?.[0]?.trim() || undefined,
        events,
      };
    });
    form.itinerary_v2_json = { days };
  }

  const draft: { version: 1; form: Partial<ProductFormState>; savedAt: number } = {
    version: 1,
    form,
    savedAt: Date.now(),
  };

  return { draft, warnings };
}

/** 빈 필드만 patch로 채우기 (문자열/배열/단순 객체). base를 변경하지 않고 새 객체 반환. */
export function mergeDraftOnlyEmpty(
  base: ProductFormDraft,
  patch: { version?: 1; form?: Partial<ProductFormState>; savedAt?: number },
): ProductFormDraft {
  const baseForm = base.form;
  const patchForm = patch.form ?? {};

  function isEmptyString(v: unknown): boolean {
    return typeof v !== "string" || v.trim() === "";
  }
  function isEmptyArray(v: unknown): boolean {
    return !Array.isArray(v) || v.length === 0;
  }
  function isEmptyObject(v: unknown): boolean {
    if (v == null || typeof v !== "object") return true;
    if (Array.isArray(v)) return v.length === 0;
    return Object.keys(v as object).length === 0;
  }

  const mergedForm = { ...baseForm } as ProductFormState;

  for (const key of Object.keys(patchForm) as (keyof ProductFormState)[]) {
    const baseVal = baseForm[key];
    const patchVal = (patchForm as Record<string, unknown>)[key];
    if (patchVal === undefined) continue;

    if (typeof baseVal === "string" && typeof patchVal === "string") {
      if (isEmptyString(baseVal) && !isEmptyString(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = patchVal;
      }
      continue;
    }
    if (Array.isArray(baseVal) && Array.isArray(patchVal)) {
      if (isEmptyArray(baseVal) && !isEmptyArray(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = [...patchVal];
      }
      continue;
    }
    if (key === "itinerary_v2_json" && typeof patchVal === "object" && patchVal !== null) {
      const baseV2 = baseForm.itinerary_v2_json;
      const patchV2 = patchVal as ItineraryV2;
      if ((!baseV2?.days?.length || baseV2.days.length === 0) && patchV2?.days?.length) {
        (mergedForm as Record<string, unknown>)[key] = {
          days: patchV2.days.map((d) => ({ ...d, events: [...(d.events ?? [])] })),
        };
      }
      continue;
    }
    if (typeof baseVal === "object" && baseVal !== null && typeof patchVal === "object" && patchVal !== null) {
      if (isEmptyObject(baseVal) && !isEmptyObject(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] =
          Array.isArray(patchVal) ? [...patchVal] : { ...(patchVal as object) };
      }
      continue;
    }
    if (typeof baseVal === "boolean" && typeof patchVal === "boolean") {
      (mergedForm as Record<string, unknown>)[key] = patchVal;
      continue;
    }
  }

  return {
    version: base.version,
    form: mergedForm,
    savedAt: patch.savedAt ?? base.savedAt,
  };
}
