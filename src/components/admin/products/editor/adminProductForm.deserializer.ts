/**
 * API/Product → Admin product form state 변환
 * 편집 진입 시 서버 응답을 폼에 주입하는 로직
 * PR8.11: 로드 직후 hydrate 적용으로 editor state 일관성 확보
 */

import type { Product } from "@/types/product";
import type { ProductFormState, TermsTemplateType } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import {
  getTimelineModelFromSchedule,
  timelineModelToStructuredDays,
} from "@/lib/products/mapProductToTimelineModel";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { normalizeOXValue } from "./adminProductForm.helpers";

/**
 * 상품 API 응답을 폼 상태로 변환.
 * 편집 진입 시 기존에 보이던 값이 그대로 보이도록 필드/fallback 규칙 유지.
 */
export function deserializeAdminProductToForm(product: Product): ProductFormState {
  const includedItems = product.included_items?.trim() ?? "";
  const excludedItems = product.excluded_items?.trim() ?? "";
  const optionalTours = product.optional_tours?.trim() ?? "";
  const termsAndNotes = product.terms_and_notes?.trim() ?? "";
  const shouldRepairLegacyDetailMix =
    !includedItems && !excludedItems && (optionalTours.length > 0 || termsAndNotes.length > 0);

  return {
    title: product.title ?? "",
    description: product.description ?? "",
    product_source_url: product.product_source_url ?? "",
    point_benefits: product.point_benefits ?? "",
    point_tourism: normalizeOXValue(product.point_tourism),
    point_guide: normalizeOXValue(product.point_guide),
    meeting_info: normalizeOXValue(product.meeting_info),
    travel_insurance: normalizeOXValue(product.travel_insurance),
    included_items: shouldRepairLegacyDetailMix ? optionalTours : product.included_items ?? "",
    excluded_items: shouldRepairLegacyDetailMix ? termsAndNotes : product.excluded_items ?? "",
    departure_from_airport: product.departure_from_airport ?? "",
    departure_from_date: product.departure_from_date ?? "",
    departure_from_time: product.departure_from_time ?? "",
    departure_to_airport: product.departure_to_airport ?? "",
    departure_to_date: product.departure_to_date ?? "",
    departure_to_time: product.departure_to_time ?? "",
    departure_flight_name: product.departure_flight_name ?? "",
    departure_baggage_limit: product.departure_baggage_limit ?? "",
    arrival_from_airport: product.arrival_from_airport ?? "",
    arrival_from_date: product.arrival_from_date ?? "",
    arrival_from_time: product.arrival_from_time ?? "",
    arrival_to_airport: product.arrival_to_airport ?? "",
    arrival_to_date: product.arrival_to_date ?? "",
    arrival_to_time: product.arrival_to_time ?? "",
    arrival_flight_name: product.arrival_flight_name ?? "",
    arrival_baggage_limit: product.arrival_baggage_limit ?? "",
    detailed_schedule: product.detailed_schedule ?? "",
    optional_tours: shouldRepairLegacyDetailMix ? "" : product.optional_tours ?? "",
    min_departure_people: product.min_departure_people ?? "",
    terms_template_type:
      (product.terms_template_type as "" | TermsTemplateType | undefined) ?? "",
    terms_and_notes: shouldRepairLegacyDetailMix ? "" : product.terms_and_notes ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    image_url: product.image_url ?? "",
    images_json: normalizeImageList(product.images_json),
    category: product.category ?? "여행상품",
    destination_id: (product.destination_id ?? "").toString().trim(),
    theme: (() => {
      const t = product.theme ?? "";
      const first = t.split(/[,\n|]+/).map((s) => s.trim()).filter(Boolean)[0];
      return first ?? "";
    })(),
    product_line_id: (product.product_line_id ?? "").toString().trim(),
    campaigns: ((): string => {
      const arr =
        product.campaigns ??
        (product as { campaigns_json?: string[] }).campaigns_json ??
        [];
      return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string").join(",") : "";
    })(),
    price: typeof product.price === "number" ? product.price.toLocaleString("ko-KR") : "",
    seasonal_price_bands: (() => {
      const b = product.seasonal_price_bands;
      const fmt = (n: number | null | undefined) =>
        typeof n === "number" && Number.isFinite(n) && n > 0 ? n.toLocaleString("ko-KR") : "";
      return {
        offSeason: fmt(b?.offSeason),
        weekend: fmt(b?.weekend),
        peakSeason: fmt(b?.peakSeason),
      };
    })(),
    duration: product.duration ?? "",
    itinerary: product.itinerary ?? "",
    inclusions: product.inclusions ?? "",
    is_active: product.is_active ?? true,
    sort_order: typeof product.sort_order === "number" ? String(product.sort_order) : "",
    status:
      product.status === "AVAILABLE" ||
      product.status === "LIMITED" ||
      product.status === "SOLD_OUT" ||
      product.status === "CONSULT_REQUIRED"
        ? product.status
        : "AVAILABLE",
    one_liner: product.one_liner ?? "",
    price_meta: product.price_meta ?? "",
    fuel_included:
      product.fuel_included === true ? "true" : product.fuel_included === false ? "false" : "",
    meta_info: product.meta_info ?? "",
    options_json: product.options ? JSON.stringify(product.options, null, 2) : "",
    itinerary_media_json: product.itinerary_media_json ?? {},
    ...((): Pick<ProductFormState, "itinerary_days_json" | "itinerary_v2_json"> => {
      const hydrated = hydrateItineraryImages({
        v2Days: product.itinerary_v2_json?.days ?? [],
        structuredDays: product.itinerary_days_json ?? [],
        unassignedImageUrls: [],
      });
      return {
        itinerary_days_json:
          hydrated.structuredDays.length > 0
            ? hydrated.structuredDays
            : timelineModelToStructuredDays(
                getTimelineModelFromSchedule(product.detailed_schedule ?? ""),
              ),
        itinerary_v2_json: { days: hydrated.v2Days },
      };
    })(),
    legacy_itinerary_text: "",
    theme_chart_json: product.theme_chart_json?.items ?? [],
    overview_accommodation: product.overview_accommodation ?? "",
    overview_region: product.overview_region ?? "",
    overview_duration: product.overview_duration ?? "",
  };
}
