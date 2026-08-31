/**
 * POST-UI-01D-1: Browse / Search listing DTO — card fields only, no PDP blobs.
 */

import type { Product, ProductTrust } from "@/types/product";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import { normalizeImageList } from "@/lib/products/images";
import { parseSeasonalPriceBandsFromUnknown } from "@/lib/products/seasonalPriceBands";
import {
  deriveDeparturesFromSchedules,
  normalizeDepartureSchedulesFromUnknown,
} from "@/lib/products/normalizeDepartureSchedules";

/** DB projection columns for listing pages (Browse + Search final fetch). */
export const PRODUCT_LISTING_COLUMN_KEYS = [
  "id",
  "title",
  "price",
  "seasonal_price_bands",
  "price_meta",
  "duration",
  "category",
  "theme",
  "meta_title",
  "status",
  "campaigns_json",
  "image_url",
  "images_json",
  "meta_info",
  "one_liner",
  "overview_accommodation",
  "overview_region",
  "overview_duration",
  "departure_from_date",
  "departure_schedules_json",
  "destination_id",
] as const;

export const PRODUCT_LISTING_SELECT = PRODUCT_LISTING_COLUMN_KEYS.join(",");

/** Heavy PDP / admin blobs intentionally excluded from listing projection. */
export const PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS = [
  "description",
  "itinerary",
  "itinerary_days",
  "itinerary_days_json",
  "itinerary_v2_json",
  "itinerary_media_json",
  "overview_json",
  "package_catalog_json",
  "golf_courses_json",
  "selling_points_json",
  "options",
  "notes",
  "golf_course_info",
  "departure_flight_name",
  "arrival_flight_name",
] as const;

/** Raw Supabase row accepted by mapProductRowToListItem (listing projection + legacy aliases). */
export type ProductListingRow = Record<string, unknown>;

export type ProductListItem = Pick<
  Product,
  | "id"
  | "title"
  | "price"
  | "seasonal_price_bands"
  | "price_meta"
  | "duration"
  | "category"
  | "theme"
  | "meta_title"
  | "status"
  | "campaigns"
  | "campaigns_json"
  | "is_recommend"
  | "is_popular"
  | "image_url"
  | "images_json"
  | "meta_info"
  | "one_liner"
  | "overview_accommodation"
  | "overview_region"
  | "overview_duration"
  | "trust"
  | "departure_from_date"
  | "departures"
  | "campaign_card_meta"
  | "destination_id"
>;

/** Card mapper + campaign hydration shared minimum shape. */
export type CampaignHydratableProduct = Pick<
  ProductListItem,
  "campaigns" | "campaigns_json" | "campaign_card_meta" | "is_recommend" | "is_popular"
>;

/** Listing / card prop source — full Product is structurally compatible. */
export type ProductCardSource = ProductListItem;

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

function normalizeTrust(raw: unknown): ProductTrust | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const recentConsultCount =
    typeof o.recentConsultCount === "number" ? o.recentConsultCount : undefined;
  const recentDays = typeof o.recentDays === "number" ? o.recentDays : undefined;
  const totalInquiries = typeof o.totalInquiries === "number" ? o.totalInquiries : undefined;
  const ratingAvg = typeof o.ratingAvg === "number" ? o.ratingAvg : undefined;
  const reviewCount = typeof o.reviewCount === "number" ? o.reviewCount : undefined;
  if (
    recentConsultCount === undefined &&
    recentDays === undefined &&
    totalInquiries === undefined &&
    ratingAvg === undefined &&
    reviewCount === undefined
  ) {
    return undefined;
  }
  return {
    recentConsultCount,
    recentDays,
    totalInquiries,
    ratingAvg,
    reviewCount,
  };
}

function normalizeListingImages(row: Record<string, unknown>): {
  image_url: string;
  images_json?: string[];
} {
  let imagesInput: Array<string | null | undefined> | null = null;
  if (Array.isArray(row.images_json)) {
    imagesInput = row.images_json as Array<string | null | undefined>;
  } else if (typeof row.images_json === "string" && row.images_json.trim()) {
    try {
      const parsed = JSON.parse(row.images_json) as unknown;
      imagesInput = Array.isArray(parsed) ? (parsed as Array<string | null | undefined>) : null;
    } catch {
      imagesInput = null;
    }
  }
  const images = normalizeImageList(imagesInput);
  const storedCover = (() => {
    if (typeof row.image_url === "string" && row.image_url.trim()) return row.image_url.trim();
    if (typeof row.image === "string" && row.image.trim()) return row.image.trim();
    return "";
  })();
  const primaryImage =
    storedCover && (images.length === 0 || images.includes(storedCover))
      ? storedCover
      : images[0] ?? storedCover;

  return {
    image_url: primaryImage,
    images_json: images.length > 0 ? images : undefined,
  };
}

function normalizeListingDepartures(row: Record<string, unknown>): string[] | undefined {
  const departureSchedules =
    normalizeDepartureSchedulesFromUnknown(row.departure_schedules_json) ?? undefined;
  const fromSchedules = deriveDeparturesFromSchedules(departureSchedules);
  if (fromSchedules?.length) return fromSchedules;

  const raw = row.departures ?? row.departures_json;
  if (Array.isArray(raw)) return normalizeStringArray(raw) ?? undefined;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? normalizeStringArray(parsed) ?? undefined : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseListingStatus(raw: unknown): ProductListItem["status"] {
  if (
    raw === "AVAILABLE" ||
    raw === "LIMITED" ||
    raw === "SOLD_OUT" ||
    raw === "CONSULT_REQUIRED"
  ) {
    return raw;
  }
  return undefined;
}

/**
 * Raw Supabase listing row → ProductListItem (slim card DTO).
 * Does not run full normalizeProduct / PDP JSON parsing.
 */
export function mapProductRowToListItem(row: Record<string, unknown>): ProductListItem {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const { image_url, images_json } = normalizeListingImages(row);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    category: String(row.category ?? row.type ?? "여행상품"),
    image_url,
    images_json,
    price,
    seasonal_price_bands:
      parseSeasonalPriceBandsFromUnknown(row.seasonal_price_bands) ?? undefined,
    price_meta:
      typeof row.price_meta === "string" && row.price_meta.trim() !== ""
        ? row.price_meta.trim()
        : undefined,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    theme: typeof row.theme === "string" ? row.theme : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    status: parseListingStatus(row.status),
    campaigns: normalizeStringArray(row.campaigns),
    campaigns_json: normalizeStringArray(row.campaigns_json ?? row.campaigns),
    is_recommend: typeof row.is_recommend === "boolean" ? row.is_recommend : undefined,
    is_popular: typeof row.is_popular === "boolean" ? row.is_popular : undefined,
    meta_info:
      typeof row.meta_info === "string" && row.meta_info.trim() !== ""
        ? row.meta_info.trim()
        : undefined,
    one_liner:
      typeof row.one_liner === "string" && row.one_liner.trim() !== ""
        ? row.one_liner.trim()
        : undefined,
    overview_accommodation:
      typeof row.overview_accommodation === "string" && row.overview_accommodation.trim() !== ""
        ? row.overview_accommodation.trim()
        : undefined,
    overview_region:
      typeof row.overview_region === "string" && row.overview_region.trim() !== ""
        ? row.overview_region.trim()
        : undefined,
    overview_duration:
      typeof row.overview_duration === "string" && row.overview_duration.trim() !== ""
        ? row.overview_duration.trim()
        : undefined,
    trust: normalizeTrust(row.trust),
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departures: normalizeListingDepartures(row),
    destination_id: (() => {
      if (row.destination_id == null) return null;
      const s =
        typeof row.destination_id === "string"
          ? row.destination_id.trim()
          : String(row.destination_id).trim();
      return s === "" ? null : s;
    })(),
    campaign_card_meta: row.campaign_card_meta as ProductCampaignCardMeta[] | undefined,
  };
}
