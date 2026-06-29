import {
  BAND_IMPORT_DEFAULT_CATEGORY,
  BAND_IMPORT_PLACEHOLDER_IMAGE,
} from "@/lib/admin/bandImport/constants";
import type { ExternalProvider } from "@/lib/admin/externalImport/detectExternalProvider";
import type { ExternalParsedProduct } from "@/lib/admin/externalImport/externalProductSchema";
import type { ItineraryV2 } from "@/types/product";
import {
  countItineraryEvents,
  countItineraryImages,
  mapExternalItineraryToV2,
} from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import { countGalleryUrls } from "@/lib/admin/externalImport/mergeExternalImport";
import { sellingPointsToJsonColumn } from "@/lib/products/normalizeSellingPoints";
import { formatSeoHashtagsForMetaTitle } from "@/lib/products/formatSeoHashtagsForMetaTitle";

export type MapExternalParsedInput = {
  parsed: ExternalParsedProduct;
  productSourceUrl?: string | null;
  provider: ExternalProvider | null;
  sourceProductTitle?: string | null;
  seoHashtags?: string[];
};

const PROVIDER_DEFAULT_CATEGORY: Record<ExternalProvider, string> = {
  hanatour: "하나투어",
  modetour: "모두투어",
};

function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeImageUrls(urls: string[] | null | undefined, max = 10): string[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (trimmed.startsWith("data:")) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function resolveItineraryV2(
  raw: ExternalParsedProduct["itinerary_v2_json"],
): ItineraryV2 | null {
  if (!raw?.days?.length) return null;
  const sample = raw.days[0]?.events?.[0] as Record<string, unknown> | undefined;
  if (sample && ("images" in sample || "displayRole" in sample || "iconKey" in sample)) {
    return raw as ItineraryV2;
  }
  return mapExternalItineraryToV2(raw);
}

function formatAirlineMetaInfo(
  airlineName: string | null,
  flightNumber: string | null,
): string | null {
  const parts = [airlineName, flightNumber].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" ") : null;
}

function pickTime(
  primary: string | null | undefined,
  legacy: string | null | undefined,
): string | null {
  return trimOrNull(primary) ?? trimOrNull(legacy);
}

function resolveMetaTitle(
  parsed: ExternalParsedProduct,
  seoHashtags?: string[],
): string | null {
  return (
    formatSeoHashtagsForMetaTitle(seoHashtags) ??
    trimOrNull(parsed.meta_title) ??
    formatSeoHashtagsForMetaTitle(parsed.seo_hashtags ?? undefined)
  );
}

export function mapExternalParsedToInsert(input: MapExternalParsedInput): Record<string, unknown> {
  const { parsed, productSourceUrl, provider, sourceProductTitle, seoHashtags } = input;

  const itineraryV2 = resolveItineraryV2(parsed.itinerary_v2_json);

  const productImages = normalizeImageUrls(parsed.images_json);
  const imageUrl =
    trimOrNull(parsed.image_url) ?? productImages[0] ?? BAND_IMPORT_PLACEHOLDER_IMAGE;
  const finalGallery =
    productImages.length > 0
      ? productImages
      : imageUrl !== BAND_IMPORT_PLACEHOLDER_IMAGE
        ? [imageUrl]
        : [];

  const title =
    trimOrNull(sourceProductTitle) ?? trimOrNull(parsed.title) ?? "제목 미정 상품";
  const description = trimOrNull(parsed.description) ?? "상품 설명을 확인해 주세요.";
  const duration = trimOrNull(parsed.duration);
  const category = provider ? PROVIDER_DEFAULT_CATEGORY[provider] : BAND_IMPORT_DEFAULT_CATEGORY;

  const airlineName = trimOrNull(parsed.airline_name);
  const departureFlight = trimOrNull(parsed.departure_flight_number);
  const arrivalFlight = trimOrNull(parsed.arrival_flight_number);

  const sellingPoints = sellingPointsToJsonColumn(parsed.selling_points_json ?? undefined);

  return {
    title,
    description,
    image_url: imageUrl,
    images_json: finalGallery.length > 0 ? finalGallery : null,
    category,
    theme: trimOrNull(parsed.theme),
    price: toSafeInteger(parsed.price),
    duration,
    overview_duration: duration,
    overview_region: trimOrNull(parsed.departure_region),
    included_items: trimOrNull(parsed.included_items),
    excluded_items: trimOrNull(parsed.excluded_items),
    optional_expenses: trimOrNull(parsed.optional_expenses),
    selling_points_json: sellingPoints,
    booking_notes: trimOrNull(parsed.booking_notes),
    is_active: true,
    status: parsed.status ?? "AVAILABLE",
    meta_title: resolveMetaTitle(parsed, seoHashtags),
    meta_info: formatAirlineMetaInfo(airlineName, departureFlight),
    departure_flight_name: departureFlight,
    departure_from_airport: trimOrNull(parsed.departure_from_airport),
    departure_to_airport: trimOrNull(parsed.departure_to_airport),
    departure_from_date: trimOrNull(parsed.departure_from_date),
    departure_from_time: pickTime(parsed.departure_from_time, parsed.departure_time),
    departure_to_date: trimOrNull(parsed.departure_to_date),
    departure_to_time: pickTime(parsed.departure_to_time, parsed.arrival_time),
    arrival_flight_name: arrivalFlight,
    arrival_from_airport: trimOrNull(parsed.arrival_from_airport),
    arrival_to_airport: trimOrNull(parsed.arrival_to_airport),
    arrival_from_date: trimOrNull(parsed.arrival_from_date),
    arrival_from_time: trimOrNull(parsed.arrival_from_time),
    arrival_to_date: trimOrNull(parsed.arrival_to_date),
    arrival_to_time: trimOrNull(parsed.arrival_to_time),
    itinerary_v2_json: itineraryV2,
    product_source_url: trimOrNull(productSourceUrl ?? undefined),
  };
}

export function summarizeExternalParsedForResponse(parsed: ExternalParsedProduct): {
  title: string | null;
  price: number | null;
  duration: string | null;
  galleryCount: number;
  itineraryEventCount: number;
  itineraryImageCount: number;
} {
  const itineraryV2 = resolveItineraryV2(parsed.itinerary_v2_json);
  return {
    title: trimOrNull(parsed.title),
    price: parsed.price,
    duration: trimOrNull(parsed.duration),
    galleryCount: countGalleryUrls(parsed),
    itineraryEventCount: countItineraryEvents(parsed.itinerary_v2_json),
    itineraryImageCount: countItineraryImages(itineraryV2),
  };
}
