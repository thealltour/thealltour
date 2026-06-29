import type { ItineraryV2 } from "@/types/product";
import {
  parseSeasonalPriceBandsFromUnknown,
  seasonalPriceBandsToJsonColumn,
} from "@/lib/products/seasonalPriceBands";
import {
  BAND_IMPORT_DEFAULT_CATEGORY,
  BAND_IMPORT_PLACEHOLDER_IMAGE,
} from "@/lib/admin/bandImport/constants";
import { mapBandOptionsToProductOptions } from "@/lib/admin/bandImport/mapBandOptionsToProductOptions";
import type {
  BandParsedItineraryDay,
  BandParsedProduct,
  BandSeasonalPriceBandNotes,
} from "@/lib/admin/bandImport/productParserSchema";

export type MapBandParsedInput = {
  parsed: BandParsedProduct;
  bandText: string;
  hwpText: string;
  productSourceUrl?: string | null;
  imageUrls?: string[];
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

function joinNonEmpty(parts: Array<string | null | undefined>, separator = "\n\n"): string | null {
  const joined = parts.map((p) => trimOrNull(p)).filter((p): p is string => Boolean(p));
  return joined.length > 0 ? joined.join(separator) : null;
}

function normalizeImageUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildDescriptionFallback(bandText: string, hwpText: string): string {
  const source = (hwpText.trim() || bandText.trim()).replace(/\s+/g, " ").trim();
  if (!source) return "상품 설명을 확인해 주세요.";
  return source.length > 500 ? `${source.slice(0, 500)}…` : source;
}

export function buildBandDescription(parsed: BandParsedProduct, bandText: string, hwpText: string): string {
  return (
    joinNonEmpty([parsed.description, parsed.band_marketing_copy]) ??
    buildDescriptionFallback(bandText, hwpText)
  );
}

export function buildBandBookingNotes(
  bookingNotes: string | null | undefined,
  seasonalNotes: BandSeasonalPriceBandNotes | null | undefined,
): string | null {
  const base = trimOrNull(bookingNotes);
  if (!seasonalNotes) return base;

  const noteLines: string[] = [];
  if (trimOrNull(seasonalNotes.offSeason)) {
    noteLines.push(`[비수기] ${seasonalNotes.offSeason!.trim()}`);
  }
  if (trimOrNull(seasonalNotes.weekend)) {
    noteLines.push(`[주말/목요일] ${seasonalNotes.weekend!.trim()}`);
  }
  if (trimOrNull(seasonalNotes.peakSeason)) {
    noteLines.push(`[성수기] ${seasonalNotes.peakSeason!.trim()}`);
  }

  if (noteLines.length === 0) return base;

  const appendix = ["", "■ 구간별 요금 안내", ...noteLines].join("\n");
  return base ? `${base}${appendix}` : noteLines.join("\n");
}

export function mapItineraryDaysToV2(days: BandParsedItineraryDay[] | null): ItineraryV2 | null {
  if (!days?.length) return null;

  const mapped = days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((day) => {
      const events: ItineraryV2["days"][number]["events"] = [];

      if (day.meals?.breakfast?.trim()) {
        events.push({ heading: "조식", description: day.meals.breakfast.trim(), timeOfDay: "오전" });
      }
      if (day.meals?.lunch?.trim()) {
        events.push({ heading: "중식", description: day.meals.lunch.trim(), timeOfDay: "오후" });
      }
      if (day.meals?.dinner?.trim()) {
        events.push({ heading: "석식", description: day.meals.dinner.trim(), timeOfDay: "저녁" });
      }

      const description = day.description?.trim();
      if (description) {
        events.push({
          heading: day.title?.trim() || `${day.day}일차`,
          description,
          timeOfDay: "종일",
        });
      } else if (day.title?.trim() && events.length === 0) {
        events.push({
          heading: day.title.trim(),
          description: "",
          timeOfDay: "종일",
        });
      }

      if (events.length === 0) return null;

      return {
        day: day.day,
        title: day.title?.trim() || `${day.day}일차`,
        events,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return mapped.length > 0 ? { days: mapped } : null;
}

export function mapBandParsedToInsert(input: MapBandParsedInput): Record<string, unknown> {
  const { parsed, bandText, hwpText, productSourceUrl, imageUrls } = input;
  const images = normalizeImageUrls(imageUrls);
  const imageUrl = images[0] ?? BAND_IMPORT_PLACEHOLDER_IMAGE;

  const title = trimOrNull(parsed.title) ?? "제목 미정 상품";
  const description = buildBandDescription(parsed, bandText, hwpText);
  const duration = trimOrNull(parsed.duration);

  const seasonalBands = seasonalPriceBandsToJsonColumn(
    parseSeasonalPriceBandsFromUnknown(parsed.seasonal_price_bands),
  );

  let price = toSafeInteger(parsed.price);
  if (price == null && seasonalBands) {
    const vals = [seasonalBands.offSeason, seasonalBands.weekend, seasonalBands.peakSeason].filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (vals.length > 0) price = Math.min(...vals);
  }

  const itineraryV2 = mapItineraryDaysToV2(parsed.itinerary_v2_json);
  const bookingNotes = buildBandBookingNotes(parsed.booking_notes, parsed.seasonal_price_band_notes);
  const productOptions = mapBandOptionsToProductOptions(parsed.options, price);

  const payload: Record<string, unknown> = {
    title,
    description,
    image_url: imageUrl,
    images_json: images.length > 0 ? images : null,
    category: trimOrNull(parsed.category) ?? BAND_IMPORT_DEFAULT_CATEGORY,
    theme: trimOrNull(parsed.theme),
    one_liner: trimOrNull(parsed.one_liner),
    price,
    seasonal_price_bands: seasonalBands,
    duration,
    overview_duration: duration,
    overview_region: trimOrNull(parsed.overview_region),
    overview_accommodation: trimOrNull(parsed.overview_accommodation),
    included_items: trimOrNull(parsed.included_items),
    excluded_items: trimOrNull(parsed.excluded_items),
    booking_notes: bookingNotes,
    options: productOptions,
    is_active: true,
    status: parsed.status ?? "AVAILABLE",
    departure_flight_name: trimOrNull(parsed.departure_flight_number),
    departure_from_airport: trimOrNull(parsed.departure_from_airport),
    departure_to_airport: trimOrNull(parsed.departure_to_airport),
    departure_from_time: trimOrNull(parsed.departure_time),
    arrival_to_time: trimOrNull(parsed.arrival_time),
    itinerary_v2_json: itineraryV2,
    product_source_url: trimOrNull(productSourceUrl ?? undefined),
  };

  return payload;
}

export function summarizeBandParsedForResponse(parsed: BandParsedProduct): {
  title: string | null;
  price: number | null;
  duration: string | null;
  status: string | null;
} {
  return {
    title: trimOrNull(parsed.title),
    price: parsed.price,
    duration: trimOrNull(parsed.duration),
    status: parsed.status,
  };
}
