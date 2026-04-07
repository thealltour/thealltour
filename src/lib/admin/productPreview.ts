/**
 * 공용 미리보기 로직: 저장 API와 preview API가 동일한 규칙 사용
 * - form → Product (formToPreviewProduct)
 * - Product → ProductCardProps / ProductDetailV2Props (직렬화 가능한 payload만, CTA는 클라이언트에서 주입)
 */

import type {
  Product,
  ProductOptions,
  ItineraryStructuredDay,
  ItineraryV2,
  SeasonalPriceBands,
} from "@/types/product";
import {
  sanitizeSeasonalPriceBandsFromFormStrings,
} from "@/lib/products/seasonalPriceBands";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { buildProductCardInfoBadges } from "@/lib/productCardProps";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct } from "@/lib/productCampaignPresentation";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";

/** 폼 필드 (API POST body 및 클라이언트 form과 호환) */
export type ProductFormPayload = {
  title?: string;
  description?: string;
  one_liner?: string;
  options_json?: string;
  image_url?: string;
  images_json?: string[];
  category?: string;
  /** 지역 1개 (product_taxonomies.id). 빈 문자열 = 미선택 */
  destination_id?: string;
  theme?: string;
  product_line_id?: string;
  campaigns?: string;
  price?: string;
  seasonal_price_bands?: {
    offSeason: string;
    weekend: string;
    peakSeason: string;
  };
  duration?: string;
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  terms_and_notes?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  sort_order?: string;
  status?: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: "" | "true" | "false";
  price_meta?: string;
  meta_info?: string;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  itinerary_media_json?: Record<string, string>;
  itinerary_days_json?: ItineraryStructuredDay[];
  itinerary_v2_json?: ItineraryV2;
  theme_chart_json?: Array<{ label: string; percent: number }>;
};

/** 폼 → 미리보기용 Product (저장 payload와 동일한 sanitize; 대표가는 구간가로 채우지 않음) */
export function formToPreviewProduct(
  form: ProductFormPayload,
  imageUrlForPreview: string,
): Product {
  const priceNumRaw = form.price ? parseInt(String(form.price).replace(/\D/g, ""), 10) : undefined;
  let price =
    priceNumRaw !== undefined && !Number.isNaN(priceNumRaw) && priceNumRaw > 0 ? priceNumRaw : undefined;
  const bandsSanitized: SeasonalPriceBands | null = form.seasonal_price_bands
    ? sanitizeSeasonalPriceBandsFromFormStrings(form.seasonal_price_bands)
    : null;
  /* PR-D: 미리보기도 구간가로 대표가를 채우지 않음(PR-B 카드는 seasonal 밴드 우선 표시) */
  const oneLiner = (
    (form.one_liner?.trim() ||
      form.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
      form.title ||
      "") as string
  ).trim();
  const options = (() => {
    const raw = form.options_json?.trim();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.groups) &&
        (parsed.groups as unknown[]).length > 0
      ) {
        return parsed as ProductOptions;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  })();

  const imagesJson = normalizeImageList(form.images_json);
  const primaryImageUrl = imageUrlForPreview?.trim() || imagesJson[0] || form.image_url?.trim() || "";

  return {
    id: "_preview",
    title: ((form.title?.trim() || "상품명") as string).slice(0, 200),
    description: (form.description?.trim() || "") as string,
    image_url: primaryImageUrl as string,
    images_json: imagesJson.length > 0 ? imagesJson : undefined,
    category: (form.category?.trim() || "여행상품") as string,
    destination_id: form.destination_id?.trim() || null,
    theme: form.theme?.trim() || undefined,
    product_line_id: form.product_line_id?.trim() || null,
    campaigns: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    campaigns_json: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    price,
    seasonal_price_bands: bandsSanitized ?? undefined,
    duration: form.duration?.trim() || undefined,
    itinerary: form.itinerary?.trim() || undefined,
    inclusions: form.inclusions?.trim() || undefined,
    point_benefits: form.point_benefits?.trim() || undefined,
    point_tourism: form.point_tourism as "O" | "X" | undefined,
    point_guide: form.point_guide as "O" | "X" | undefined,
    meeting_info: form.meeting_info as "O" | "X" | undefined,
    travel_insurance: form.travel_insurance as "O" | "X" | undefined,
    included_items: form.included_items?.trim() || undefined,
    excluded_items: form.excluded_items?.trim() || undefined,
    detailed_schedule: form.detailed_schedule?.trim() || undefined,
    optional_tours: form.optional_tours?.trim() || undefined,
    min_departure_people: form.min_departure_people?.trim() || undefined,
    terms_and_notes: form.terms_and_notes?.trim() || undefined,
    product_source_url: form.product_source_url?.trim() || undefined,
    departure_from_airport: form.departure_from_airport?.trim() || undefined,
    departure_from_date: form.departure_from_date?.trim() || undefined,
    departure_from_time: form.departure_from_time?.trim() || undefined,
    departure_to_airport: form.departure_to_airport?.trim() || undefined,
    departure_to_date: form.departure_to_date?.trim() || undefined,
    departure_to_time: form.departure_to_time?.trim() || undefined,
    departure_flight_name: form.departure_flight_name?.trim() || undefined,
    departure_baggage_limit: form.departure_baggage_limit?.trim() || undefined,
    arrival_from_airport: form.arrival_from_airport?.trim() || undefined,
    arrival_from_date: form.arrival_from_date?.trim() || undefined,
    arrival_from_time: form.arrival_from_time?.trim() || undefined,
    arrival_to_airport: form.arrival_to_airport?.trim() || undefined,
    arrival_to_date: form.arrival_to_date?.trim() || undefined,
    arrival_to_time: form.arrival_to_time?.trim() || undefined,
    arrival_flight_name: form.arrival_flight_name?.trim() || undefined,
    arrival_baggage_limit: form.arrival_baggage_limit?.trim() || undefined,
    meta_title: form.meta_title?.trim() || undefined,
    meta_description: form.meta_description?.trim() || undefined,
    is_active: form.is_active ?? true,
    sort_order: form.sort_order ? parseInt(String(form.sort_order), 10) : undefined,
    status: form.status || "AVAILABLE",
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true",
    price_meta: ((form.price_meta?.trim() || "1인 기준") as string) || undefined,
    meta_info: form.meta_info?.trim() || undefined,
    overview_accommodation: form.overview_accommodation?.trim() || undefined,
    overview_region: form.overview_region?.trim() || undefined,
    overview_duration: form.overview_duration?.trim() || undefined,
    one_liner: oneLiner || undefined,
    options,
    itinerary_media_json:
      form.itinerary_media_json && Object.keys(form.itinerary_media_json).length > 0
        ? form.itinerary_media_json
        : undefined,
    itinerary_days_json:
      form.itinerary_days_json && form.itinerary_days_json.length > 0
        ? form.itinerary_days_json
        : undefined,
    itinerary_v2_json:
      form.itinerary_v2_json?.days?.length
        ? form.itinerary_v2_json
        : undefined,
    theme_chart_json: (() => {
      const items = form.theme_chart_json?.filter((i) => i?.label?.trim() && typeof i.percent === "number") ?? [];
      return items.length >= 2 ? { items } : undefined;
    })(),
    // overview는 mapProductToOverview(product)로 자동 생성
  };
}

/** Product → 카드용 props (직렬화 가능, CTA는 클라이언트에서 추가) */
export type ProductCardPropsPayload = {
  title?: string;
  price?: number;
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** campaign 대표 배지 */
  badges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  /** 테마·카테고리 정보성 배지 */
  infoBadges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  thumbnailUrl?: string;
  priceMeta?: string;
  metaInfo?: string;
  /** grid 미리보기 — 피치는 보통 생략 */
  campaignPitchLine?: string;
};

export function productToCardPropsPayload(product: Product): ProductCardPropsPayload {
  return {
    title: product.title,
    price: product.price,
    seasonal_price_bands: product.seasonal_price_bands ?? undefined,
    duration: product.duration,
    region: product.theme,
    categories: [product.category],
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status: (product.status ?? "AVAILABLE") as ProductCardPropsPayload["status"],
    badges: buildCampaignRepresentativeBadges(product),
    infoBadges: buildProductCardInfoBadges(product),
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta || "1인 기준",
    metaInfo: product.meta_info ?? "",
    campaignPitchLine: buildCampaignPitchLineFromProduct(product, "grid"),
  };
}

/** Product → 상세용 props (직렬화 가능, onConsultClick/kakaoHref 등은 클라이언트에서 추가) */
export type ProductDetailV2PropsPayload = {
  title?: string;
  region?: string;
  category?: string;
  statusTag?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  oneLiner?: string;
  priceFormatted: string | null;
  duration?: string;
  priceMeta?: string;
  fuelIncluded?: boolean;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
  trust?: unknown;
  options?: ProductOptions;
  basePrice?: number;
  /** 있으면 ProductDetailV2가 mapProductToOverview(product)로 오버뷰 자동 생성 */
  product?: Product | null;
  /** product 없을 때만 사용 */
  overviewModel?: TravelOverviewModel | null;
  overviewFallbackUrl?: string;
};

export function productToDetailV2PropsPayload(product: Product): ProductDetailV2PropsPayload {
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title ||
    "";
  const priceFormatted = product.price != null ? formatPriceKR(product.price) : null;
  return {
    title: product.title,
    region: product.theme,
    category: product.category,
    statusTag: (product.status ?? "AVAILABLE") as ProductDetailV2PropsPayload["statusTag"],
    oneLiner,
    priceFormatted,
    duration: product.duration ?? "",
    priceMeta: product.price_meta || "1인 기준",
    fuelIncluded: product.fuel_included,
    includedItems: product.included_items ?? "",
    excludedItems: product.excluded_items ?? "",
    detailedSchedule: product.detailed_schedule ?? product.itinerary ?? "",
    optionalTours: product.optional_tours ?? "",
    minDeparturePeople: product.min_departure_people ?? "",
    termsAndNotes: product.terms_and_notes ?? "",
    trust: undefined,
    options: product.options,
    basePrice: product.price,
    product,
    overviewModel: mapProductToOverview(product),
    overviewFallbackUrl: getPrimaryImageUrl(product),
  };
}
