/**
 * Admin product form — canonical 필드 derive / normalize
 * UI는 단일 입력, 저장·로드 시 DB 호환 필드 자동 동기화
 */

import type { ProductFormState } from "@/types/adminProductForm";

export type DeriveDerivedFieldsOptions = {
  /** destination_id에 대응하는 taxonomy leaf 이름 */
  destinationName?: string | null;
};

/** meta_info / itinerary에서 호텔·숙소 힌트 추출 (getHotelValue와 동일 패턴) */
export function extractHotelHintFromText(raw?: string | null): string {
  const meta = raw?.trim();
  if (!meta) return "";
  const m = meta.match(/(\d+성|전일정\s*\d+성|호텔|리조트)/i);
  if (m) return m[1];
  if (meta.length <= 30) return meta;
  return "";
}

/**
 * 저장 직전 derive: taxonomy·duration → legacy/overview 컬럼 mirror
 */
export function deriveDerivedFieldsForSave(
  form: ProductFormState,
  options?: DeriveDerivedFieldsOptions,
): ProductFormState {
  const duration = form.duration.trim();
  const destinationName = options?.destinationName?.trim() ?? "";
  const category =
    destinationName ||
    form.category.trim() ||
    "";
  const overviewRegion =
    form.overview_region.trim() ||
    destinationName ||
    form.category.trim() ||
    "";
  const overviewDuration =
    form.overview_duration.trim() ||
    duration ||
    "";

  return {
    ...form,
    category,
    overview_region: overviewRegion,
    overview_duration: overviewDuration,
    duration,
  };
}

/**
 * API → 폼 로드 시 canonical 필드로 통합 (UI 중복 입력 방지)
 */
export function normalizeFormFromProduct(form: ProductFormState): ProductFormState {
  const duration = form.duration.trim() || form.overview_duration.trim();
  const accommodation =
    form.overview_accommodation.trim() ||
    extractHotelHintFromText(form.meta_info) ||
    "";

  return {
    ...form,
    duration,
    overview_accommodation: accommodation,
    /** UI에서 taxonomy/duration 단일 입력 — derive 시 serializer가 재채움 */
    overview_region: "",
    overview_duration: "",
  };
}

/**
 * legacy 일정만 있는 상품 여부 (v2 없음)
 */
export function hasLegacyScheduleOnly(form: ProductFormState): boolean {
  const v2Days = form.itinerary_v2_json?.days ?? [];
  const hasV2Content = v2Days.some(
    (d) =>
      (d.title?.trim() ?? "") !== "" ||
      (d.dateText?.trim() ?? "") !== "" ||
      (d.events ?? []).some(
        (e) => (e.heading?.trim() ?? "") !== "" || (e.description?.trim() ?? "") !== "",
      ),
  );
  if (hasV2Content) return false;
  const structured = form.itinerary_days_json ?? [];
  if (structured.length > 0) return true;
  return (form.detailed_schedule?.trim() ?? "").length > 0;
}
