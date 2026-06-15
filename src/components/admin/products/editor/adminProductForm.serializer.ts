/**
 * Admin product form → API 저장 payload 변환
 * PR8.11: 저장 직전 serialize 적용으로 이미지 규칙 일관성 확보
 * PR9: create/update 동일 규칙, API 정수 계약(toSafeInteger) 적용
 */

import type { ProductFormState } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import { serializeStructuredDaysToSchedule } from "@/lib/products/mapProductToTimelineModel";
import { serializeItineraryImages } from "@/lib/images/serializeItineraryImages";
import { parseDetailedSchedule } from "./adminProductForm.helpers";
import type { AdminProductSavePayload } from "./adminProductForm.types";
import {
  sanitizeSeasonalPriceBandsFromFormStrings,
  seasonalPriceBandsToJsonColumn,
} from "@/lib/products/seasonalPriceBands";

/** PostgreSQL integer 호환: 유한 정수만, 범위 초과 시 null */
function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

export type SerializeAdminProductFormOptions = {
  /** 편집 모드일 때 레거시 포함·불포함 보정 적용 */
  editingId?: string | null;
  /** 미할당 이미지 URL (Modetour 등). serialize 시 event와 중복 제거에 사용 */
  unassignedImageUrls?: string[];
};

/**
 * 폼 상태를 API POST/PATCH body로 변환.
 * 저장 결과가 기존과 동일하도록 필드/타입 규칙 유지.
 */
export function serializeAdminProductForm(
  form: ProductFormState,
  options?: SerializeAdminProductFormOptions,
): AdminProductSavePayload {
  const normalizedIncludedItems = form.included_items.trim();
  const normalizedExcludedItems = form.excluded_items.trim();
  const normalizedOptionalTours = form.optional_tours.trim();
  const normalizedTermsAndNotes = form.terms_and_notes.trim();
  const shouldRepairLegacyDetailMix =
    Boolean(options?.editingId) &&
    !normalizedIncludedItems &&
    !normalizedExcludedItems &&
    (normalizedOptionalTours.length > 0 || normalizedTermsAndNotes.length > 0);
  const resolvedIncludedItems = shouldRepairLegacyDetailMix
    ? normalizedOptionalTours
    : normalizedIncludedItems;
  const resolvedExcludedItems = shouldRepairLegacyDetailMix
    ? normalizedTermsAndNotes
    : normalizedExcludedItems;
  const resolvedOptionalTours = shouldRepairLegacyDetailMix ? "" : normalizedOptionalTours;
  const legacyTermsColumnAfterRepair = shouldRepairLegacyDetailMix ? "" : normalizedTermsAndNotes;

  const normalizedBookingNotes = form.booking_notes.trim();
  const normalizedTravelNotes = form.travel_notes.trim();
  const normalizedBookingConditions = form.booking_conditions.trim();
  const normalizedRefundPolicy = form.refund_policy.trim();
  const hasSplitNoticeFields =
    normalizedBookingNotes.length > 0 ||
    normalizedTravelNotes.length > 0 ||
    normalizedBookingConditions.length > 0 ||
    normalizedRefundPolicy.length > 0 ||
    form.booking_notes_template_type !== "" ||
    form.travel_notes_template_type !== "" ||
    form.booking_conditions_template_type !== "" ||
    form.refund_policy_template_type !== "";
  /**
   * PR-B: 분리 필드·환불 규정 중 하나라도 쓰이면 terms_and_notes는 저장하지 않음(레거시 단일 컬럼 정리).
   * TODO(PR-H): legacy column (terms_and_notes) is temporary — remove after full migration
   */
  const termsAndNotesForPayload =
    hasSplitNoticeFields ? null : legacyTermsColumnAfterRepair === "" ? null : legacyTermsColumnAfterRepair;

  const normalizedPrice = form.price.replace(/,/g, "").replace(/~/g, "").trim();
  const bandsSanitized = sanitizeSeasonalPriceBandsFromFormStrings(form.seasonal_price_bands);
  const bandsForDb = seasonalPriceBandsToJsonColumn(bandsSanitized);

  const priceForPayload: number | null =
    normalizedPrice === "" ? null : toSafeInteger(Number(normalizedPrice));
  /* PR-D: 대표가(price)는 구간가에서 자동 보정하지 않음 — 운영자가 price를 직접 관리 */
  const normalizedImages = normalizeImageList(form.images_json);
  const primaryImageUrl = form.image_url.trim() || normalizedImages[0] || "";

  const serialized = serializeItineraryImages({
    v2Days: form.itinerary_v2_json?.days ?? [],
    structuredDays: form.itinerary_days_json ?? [],
    unassignedImageUrls: options?.unassignedImageUrls ?? [],
  });

  const payload: AdminProductSavePayload = {
    title: form.title.trim(),
    description: form.description,
    meta_title: form.meta_title.trim() === "" ? null : form.meta_title.trim(),
    meta_description: form.meta_description.trim() === "" ? null : form.meta_description.trim(),
    point_benefits: form.point_benefits.trim() === "" ? null : form.point_benefits.trim(),
    point_tourism: form.point_tourism,
    point_guide: form.point_guide,
    meeting_info: form.meeting_info,
    travel_insurance: form.travel_insurance,
    included_items: resolvedIncludedItems === "" ? null : resolvedIncludedItems,
    excluded_items: resolvedExcludedItems === "" ? null : resolvedExcludedItems,
    departure_from_airport:
      form.departure_from_airport.trim() === "" ? null : form.departure_from_airport.trim(),
    departure_from_date: form.departure_from_date.trim() === "" ? null : form.departure_from_date.trim(),
    departure_from_time: form.departure_from_time.trim() === "" ? null : form.departure_from_time.trim(),
    departure_to_airport: form.departure_to_airport.trim() === "" ? null : form.departure_to_airport.trim(),
    departure_to_date: form.departure_to_date.trim() === "" ? null : form.departure_to_date.trim(),
    departure_to_time: form.departure_to_time.trim() === "" ? null : form.departure_to_time.trim(),
    departure_flight_name:
      form.departure_flight_name.trim() === "" ? null : form.departure_flight_name.trim(),
    departure_baggage_limit:
      form.departure_baggage_limit.trim() === "" ? null : form.departure_baggage_limit.trim(),
    arrival_from_airport:
      form.arrival_from_airport.trim() === "" ? null : form.arrival_from_airport.trim(),
    arrival_from_date: form.arrival_from_date.trim() === "" ? null : form.arrival_from_date.trim(),
    arrival_from_time: form.arrival_from_time.trim() === "" ? null : form.arrival_from_time.trim(),
    arrival_to_airport: form.arrival_to_airport.trim() === "" ? null : form.arrival_to_airport.trim(),
    arrival_to_date: form.arrival_to_date.trim() === "" ? null : form.arrival_to_date.trim(),
    arrival_to_time: form.arrival_to_time.trim() === "" ? null : form.arrival_to_time.trim(),
    arrival_flight_name: form.arrival_flight_name.trim() === "" ? null : form.arrival_flight_name.trim(),
    arrival_baggage_limit:
      form.arrival_baggage_limit.trim() === "" ? null : form.arrival_baggage_limit.trim(),
    detailed_schedule:
      form.itinerary_days_json.length > 0
        ? serializeStructuredDaysToSchedule(form.itinerary_days_json)
        : (form.detailed_schedule.trim() === "" ? null : form.detailed_schedule.trim()),
    optional_tours: resolvedOptionalTours === "" ? null : resolvedOptionalTours,
    min_departure_people: form.min_departure_people.trim() === "" ? null : form.min_departure_people.trim(),
    terms_template_type: form.terms_template_type === "" ? null : form.terms_template_type,
    terms_and_notes: termsAndNotesForPayload,
    booking_notes: normalizedBookingNotes === "" ? null : normalizedBookingNotes,
    travel_notes: normalizedTravelNotes === "" ? null : normalizedTravelNotes,
    booking_conditions:
      normalizedBookingConditions === "" ? null : normalizedBookingConditions,
    booking_notes_template_type:
      form.booking_notes_template_type === "" ? null : form.booking_notes_template_type,
    travel_notes_template_type:
      form.travel_notes_template_type === "" ? null : form.travel_notes_template_type,
    booking_conditions_template_type:
      form.booking_conditions_template_type === ""
        ? null
        : form.booking_conditions_template_type,
    refund_policy: normalizedRefundPolicy === "" ? null : normalizedRefundPolicy,
    refund_policy_template_type:
      form.refund_policy_template_type === "" ? null : form.refund_policy_template_type,
    product_source_url: form.product_source_url.trim() === "" ? null : form.product_source_url.trim(),
    image_url: primaryImageUrl,
    images_json: normalizedImages.length > 0 ? normalizedImages : undefined,
    category: String(form.category ?? "").trim(),
    destination_id: form.destination_id.trim() === "" ? null : form.destination_id.trim(),
    theme: (form.theme ?? "").trim() === "" ? null : String(form.theme).trim(),
    product_line_id: form.product_line_id.trim() === "" ? null : form.product_line_id.trim(),
    campaigns: ((): string[] | null => {
      const s = form.campaigns.trim();
      if (!s) return null;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    })(),
    price: priceForPayload,
    seasonal_price_bands: bandsForDb,
    duration: form.duration.trim() === "" ? null : form.duration,
    itinerary: form.itinerary.trim() === "" ? null : form.itinerary,
    inclusions: form.inclusions.trim() === "" ? null : form.inclusions,
    is_active: form.is_active,
    sort_order: form.sort_order.trim() === "" ? null : toSafeInteger(Number(form.sort_order)),
    status:
      form.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(form.status)
        ? form.status
        : undefined,
    one_liner: form.one_liner.trim() === "" ? null : form.one_liner.trim(),
    price_meta: form.price_meta.trim() === "" ? null : form.price_meta.trim(),
    meta_info: form.meta_info.trim() === "" ? null : form.meta_info.trim(),
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true"
          ? true
          : form.fuel_included === "false"
            ? false
            : undefined,
    options: (() => {
      const raw = form.options_json.trim();
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.groups) &&
          parsed.groups.length > 0
        ) {
          return parsed;
        }
        return undefined;
      } catch {
        return undefined;
      }
    })(),
    itinerary_media_json: (() => {
      const media = { ...form.itinerary_media_json };
      serialized.v2Days.forEach((day) => {
        const coverUrl = day.coverImageUrl?.trim();
        if (coverUrl) {
          media[String(day.day)] = coverUrl;
        }
      });
      const dayCount =
        serialized.v2Days.length > 0
          ? serialized.v2Days.length
          : serialized.structuredDays.length > 0
            ? serialized.structuredDays.length
            : form.itinerary_days_json.length > 0
              ? form.itinerary_days_json.length
              : parseDetailedSchedule(form.detailed_schedule).length;
      const cleaned = Object.fromEntries(
        Object.entries(media).filter(([key, v]) => {
          if (typeof v !== "string" || !v.trim()) return false;
          const n = parseInt(key, 10);
          return !Number.isNaN(n) && n >= 1 && n <= dayCount;
        }),
      );
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    })(),
    itinerary_days_json:
      serialized.structuredDays.length > 0 ? serialized.structuredDays : null,
    itinerary_v2_json:
      serialized.v2Days.length > 0 ? { days: serialized.v2Days } : null,
    theme_chart_json: (() => {
      const items = form.theme_chart_json.filter(
        (i) => i.label?.trim() && typeof i.percent === "number",
      );
      return items.length >= 2 ? { items } : null;
    })(),
    overview_accommodation:
      form.overview_accommodation.trim() === "" ? null : form.overview_accommodation.trim(),
    overview_region: form.overview_region.trim() === "" ? null : form.overview_region.trim(),
    overview_duration: form.overview_duration.trim() === "" ? null : form.overview_duration.trim(),
  };

  return payload;
}
