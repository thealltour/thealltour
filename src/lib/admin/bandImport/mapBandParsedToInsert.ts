import type { ItineraryV2, ItineraryV2Event } from "@/types/product";
import {
  parseSeasonalPriceBandsFromUnknown,
  seasonalPriceBandsToJsonColumn,
} from "@/lib/products/seasonalPriceBands";
import {
  BAND_IMPORT_DEFAULT_CATEGORY,
  BAND_IMPORT_PLACEHOLDER_IMAGE,
} from "@/lib/admin/bandImport/constants";
import { mapBandOptionsToProductOptions } from "@/lib/admin/bandImport/mapBandOptionsToProductOptions";
import { splitTimedItineraryDescription } from "@/lib/admin/bandImport/splitTimedItineraryDescription";
import type {
  BandParsedItineraryDay,
  BandParsedItineraryEvent,
  BandParsedProduct,
  BandSeasonalPriceBandNotes,
} from "@/lib/admin/bandImport/productParserSchema";
import {
  inferDisplayRoleFromHeading,
  inferIconKeyFromHeading,
  isItinerarySummaryEvent,
} from "@/lib/admin/externalImport/sanitizeAiItinerary";
import { sellingPointsToJsonColumn } from "@/lib/products/normalizeSellingPoints";
import {
  departureSchedulesToJsonColumn,
  getDepartureSchedulesMinPrice,
} from "@/lib/products/normalizeDepartureSchedules";
import {
  normalizeProductDepartureDateToYmd,
  normalizeProductDepartureDateToYmdWithForcedYear,
} from "@/lib/products/productDepartureDates";
import { kstTodayYmd } from "@/lib/inquiry/desiredDeparture";
import { trimOrNull } from "@/lib/admin/stringHelpers";
import { normalizeThemeChartForInsert } from "@/lib/admin/themeChartSchema";
import { normalizeGolfCoursesJson } from "@/lib/admin/golfCourses";
import { normalizeSeoMetaTitleKeywords } from "@/lib/products/seoMetaTitleAi";
import type { ProductDepartureSchedule } from "@/types/product";

export type MapBandParsedInput = {
  parsed: BandParsedProduct;
  bandText: string;
  hwpText: string;
  golfCourseInfo?: string | null;
  golfCoursesJson?: Array<{ name: string; content: string }> | null;
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

function extractMostFrequentYear(years: number[]): number | null {
  if (!years.length) return null;
  const counts = new Map<number, number>();
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * 원문에서 일정·투어 연도로 쓰인 값만 추출합니다.
 * `2026년` 형태만 신뢰합니다. 작성일(2023.01.15)·문서번호(2023-0042)·단독 2023 등은 제외합니다.
 */
export function extractExplicitScheduleYearsFromText(text: string): number[] {
  return [...text.matchAll(/(20\d{2})\s*년/g)].map((m) => Number(m[1]));
}

/** 밴드/HWP 원문에 투어 연도(`20xx년`)가 명시돼 있는지 */
export function hasExplicitYearInBandSource(bandText: string, hwpText: string): boolean {
  return extractExplicitScheduleYearsFromText(`${bandText}\n${hwpText}`).length > 0;
}

/** 밴드/HWP 원문에서 기본 연도 추론 — `20xx년`만 신뢰, 없으면 KST 올해 */
export function inferBandScheduleDefaultYear(bandText: string, hwpText: string): number {
  const textYear = extractMostFrequentYear(
    extractExplicitScheduleYearsFromText(`${bandText}\n${hwpText}`),
  );
  if (textYear) return textYear;
  return Number(kstTodayYmd().slice(0, 4));
}

type NormalizeBandDateOptions = {
  forceDefaultYear?: boolean;
  allowedYears?: number[];
};

function normalizeBandDateField(
  raw: string | null | undefined,
  defaultYear: number,
  opts?: NormalizeBandDateOptions,
): string | null {
  const trimmed = trimOrNull(raw);
  if (!trimmed) return null;

  if (opts?.forceDefaultYear) {
    return normalizeProductDepartureDateToYmdWithForcedYear(trimmed, defaultYear);
  }

  const normalized = normalizeProductDepartureDateToYmd(trimmed, { defaultYear });
  if (!normalized) return null;

  const allowed = opts?.allowedYears;
  if (allowed?.length) {
    const year = Number(normalized.slice(0, 4));
    if (!allowed.includes(year)) {
      return normalizeProductDepartureDateToYmdWithForcedYear(trimmed, defaultYear);
    }
  }

  return normalized;
}

function resolveBandScheduleStatus(
  status: string | null | undefined,
): NonNullable<ProductDepartureSchedule["status"]> {
  if (status === "AVAILABLE" || status === "LIMITED" || status === "SOLD_OUT") {
    return status;
  }
  return "AVAILABLE";
}

function mapBandDepartureSchedules(
  parsed: BandParsedProduct,
  defaultYear: number,
  dateOpts: NormalizeBandDateOptions,
): ProductDepartureSchedule[] | null {
  const rows = parsed.departure_schedules;
  if (!rows?.length) return null;

  const schedules: ProductDepartureSchedule[] = [];
  for (const row of rows) {
    const departureRaw = trimOrNull(row.departure_date);
    if (!departureRaw) continue;

    const departureDate =
      normalizeBandDateField(departureRaw, defaultYear, dateOpts) ?? departureRaw;
    const returnRaw = trimOrNull(row.return_date);
    const returnDate = returnRaw
      ? normalizeBandDateField(returnRaw, defaultYear, dateOpts) ?? returnRaw
      : null;

    schedules.push({
      departureDate,
      returnDate,
      price: toSafeInteger(row.price),
      label: trimOrNull(row.label),
      status: resolveBandScheduleStatus(row.status),
    });
  }

  return departureSchedulesToJsonColumn(schedules);
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

function pickTime(
  primary: string | null | undefined,
  legacy: string | null | undefined,
): string | null {
  return trimOrNull(primary) ?? trimOrNull(legacy);
}

function formatAirlineMetaInfo(
  airlineName: string | null,
  flightNumber: string | null,
): string | null {
  const parts = [airlineName, flightNumber].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildDescriptionFallback(bandText: string, hwpText: string): string {
  const joined = joinNonEmpty([hwpText, bandText], "\n\n");
  if (joined) return joined.replace(/\r\n/g, "\n");
  return "상품 설명을 확인해 주세요.";
}

export function buildBandDescription(parsed: BandParsedProduct, bandText: string, hwpText: string): string {
  const marketing = trimOrNull(parsed.band_marketing_copy);
  const overview = trimOrNull(parsed.description);
  if (!marketing && !overview) {
    return buildDescriptionFallback(bandText, hwpText);
  }
  const resolvedMarketing = marketing ?? trimOrNull(bandText);
  return joinNonEmpty([resolvedMarketing, overview]) ?? buildDescriptionFallback(bandText, hwpText);
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

function countClockTimes(text: string): number {
  return [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].length;
}

function normalizeTimeText(raw: string | null | undefined): string | undefined {
  const trimmed = trimOrNull(raw);
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function inferTimeOfDayFromClock(timeText: string | undefined): ItineraryV2Event["timeOfDay"] | undefined {
  const match = timeText?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  if (hour < 12) return "오전";
  if (hour < 17) return "오후";
  return "저녁";
}

function toV2Event(input: {
  heading: string;
  description?: string | null;
  timeText?: string | null;
  timeOfDay?: ItineraryV2Event["timeOfDay"] | null;
  location?: string | null;
}): ItineraryV2Event {
  const heading = input.heading.trim();
  const timeText = normalizeTimeText(input.timeText);
  return {
    heading,
    description: trimOrNull(input.description) ?? undefined,
    timeText,
    timeOfDay: input.timeOfDay ?? inferTimeOfDayFromClock(timeText),
    location: trimOrNull(input.location) ?? undefined,
    iconKey: inferIconKeyFromHeading(heading),
    displayRole: inferDisplayRoleFromHeading(heading),
  };
}

function mapParsedEvent(ev: BandParsedItineraryEvent): ItineraryV2Event | null {
  const heading = ev.heading?.trim();
  if (!heading) return null;
  return toV2Event(ev);
}

function mealEventsFromDay(day: BandParsedItineraryDay): ItineraryV2Event[] {
  const out: ItineraryV2Event[] = [];
  if (day.meals?.breakfast?.trim()) {
    out.push(toV2Event({ heading: "조식", description: day.meals.breakfast, timeOfDay: "오전" }));
  }
  if (day.meals?.lunch?.trim()) {
    out.push(toV2Event({ heading: "중식", description: day.meals.lunch, timeOfDay: "오후" }));
  }
  if (day.meals?.dinner?.trim()) {
    out.push(toV2Event({ heading: "석식", description: day.meals.dinner, timeOfDay: "저녁" }));
  }
  return out;
}

function hasMealHeading(events: ItineraryV2Event[], mealHeading: string): boolean {
  return events.some((ev) => {
    const heading = ev.heading.trim();
    if (heading === mealHeading) return true;
    return isItinerarySummaryEvent(ev) && heading.includes(mealHeading);
  });
}

function appendMissingMeals(events: ItineraryV2Event[], day: BandParsedItineraryDay): ItineraryV2Event[] {
  const extra = mealEventsFromDay(day).filter((meal) => !hasMealHeading(events, meal.heading));
  return extra.length > 0 ? [...events, ...extra] : events;
}

function sortActivityThenSummary(events: ItineraryV2Event[]): ItineraryV2Event[] {
  const activities: ItineraryV2Event[] = [];
  const summaries: ItineraryV2Event[] = [];
  for (const ev of events) {
    if (isItinerarySummaryEvent(ev)) summaries.push(ev);
    else activities.push(ev);
  }
  activities.sort((a, b) => {
    if (a.timeText && b.timeText) return a.timeText.localeCompare(b.timeText);
    return 0;
  });
  return [...activities, ...summaries];
}

function eventsFromLegacyDescription(day: BandParsedItineraryDay): ItineraryV2Event[] {
  const description = day.description?.trim();
  if (!description) {
    if (day.title?.trim()) {
      return [toV2Event({ heading: day.title.trim(), description: "", timeOfDay: "종일" })];
    }
    return [];
  }

  const clockCount = countClockTimes(description);
  const split = splitTimedItineraryDescription(description);
  if (clockCount >= 2 && split.length >= 2) {
    return split.map((chunk) =>
      toV2Event({
        heading: chunk.heading,
        description: chunk.description,
        timeText: chunk.timeText,
      }),
    );
  }

  return [
    toV2Event({
      heading: day.title?.trim() || `${day.day}일차`,
      description,
      timeOfDay: "종일",
    }),
  ];
}

export function mapItineraryDaysToV2(days: BandParsedItineraryDay[] | null): ItineraryV2 | null {
  if (!days?.length) return null;

  const mapped = days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((day) => {
      const parsedEvents = (day.events ?? [])
        .map((ev) => mapParsedEvent(ev))
        .filter((ev): ev is ItineraryV2Event => ev !== null);
      const source = parsedEvents.length > 0 ? parsedEvents : eventsFromLegacyDescription(day);
      const events = sortActivityThenSummary(appendMissingMeals(source, day));

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
  const { parsed, bandText, hwpText, golfCourseInfo, golfCoursesJson, productSourceUrl, imageUrls } = input;
  const images = normalizeImageUrls(imageUrls);
  const imageUrl = images[0] ?? BAND_IMPORT_PLACEHOLDER_IMAGE;

  const title = trimOrNull(parsed.title) ?? "제목 미정 상품";
  const description = buildBandDescription(parsed, bandText, hwpText);
  const duration = trimOrNull(parsed.duration);

  const seasonalBands = seasonalPriceBandsToJsonColumn(
    parseSeasonalPriceBandsFromUnknown(parsed.seasonal_price_bands),
  );

  const allowedYears = extractExplicitScheduleYearsFromText(`${bandText}\n${hwpText}`);
  const defaultYear = inferBandScheduleDefaultYear(bandText, hwpText);
  const forceDefaultYear = allowedYears.length === 0;
  const dateOpts: NormalizeBandDateOptions = { forceDefaultYear, allowedYears };
  const departureSchedulesJson = mapBandDepartureSchedules(parsed, defaultYear, dateOpts);

  let price = toSafeInteger(parsed.price);
  const scheduleMinPrice = getDepartureSchedulesMinPrice(
    departureSchedulesJson ?? undefined,
  );
  if (scheduleMinPrice != null) {
    price = scheduleMinPrice;
  } else if (price == null && seasonalBands) {
    const vals = [seasonalBands.offSeason, seasonalBands.weekend, seasonalBands.peakSeason].filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (vals.length > 0) price = Math.min(...vals);
  }

  const itineraryV2 = mapItineraryDaysToV2(parsed.itinerary_v2_json);
  const bookingNotes = buildBandBookingNotes(parsed.booking_notes, parsed.seasonal_price_band_notes);
  const productOptions = mapBandOptionsToProductOptions(parsed.options, price);
  const sellingPoints = sellingPointsToJsonColumn(parsed.selling_points_json ?? undefined);

  const departureFlight = trimOrNull(parsed.departure_flight_number);
  const arrivalFlight = trimOrNull(parsed.arrival_flight_number);

  const firstScheduleDate =
    departureSchedulesJson?.[0]?.departureDate ?? null;
  const resolvedDepartureFromDate =
    normalizeBandDateField(parsed.departure_from_date, defaultYear, dateOpts) ??
    firstScheduleDate;

  const payload: Record<string, unknown> = {
    title,
    description,
    golf_course_info: trimOrNull(golfCourseInfo),
    golf_courses_json: normalizeGolfCoursesJson(golfCoursesJson),
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
    optional_expenses: trimOrNull(parsed.optional_expenses),
    optional_tours: trimOrNull(parsed.optional_tours),
    selling_points_json: sellingPoints,
    detailed_schedule: trimOrNull(parsed.detailed_schedule),
    travel_notes: trimOrNull(parsed.travel_notes),
    booking_conditions: trimOrNull(parsed.booking_conditions),
    terms_and_notes: trimOrNull(parsed.terms_and_notes),
    refund_policy: trimOrNull(parsed.refund_policy),
    min_departure_people: trimOrNull(parsed.min_departure_people),
    meta_title: normalizeSeoMetaTitleKeywords(parsed.meta_title),
    meta_description: trimOrNull(parsed.meta_description),
    point_benefits: trimOrNull(parsed.point_benefits),
    point_tourism: parsed.point_tourism ?? null,
    point_guide: parsed.point_guide ?? null,
    meeting_info: parsed.meeting_info ?? null,
    travel_insurance: parsed.travel_insurance ?? null,
    booking_notes: bookingNotes,
    options: productOptions,
    is_active: true,
    status: parsed.status ?? "AVAILABLE",
    meta_info: formatAirlineMetaInfo(trimOrNull(parsed.airline_name), departureFlight),
    departure_flight_name: departureFlight,
    departure_from_airport: trimOrNull(parsed.departure_from_airport),
    departure_to_airport: trimOrNull(parsed.departure_to_airport),
    departure_from_date: resolvedDepartureFromDate,
    departure_from_time: pickTime(parsed.departure_from_time, parsed.departure_time),
    departure_to_date: normalizeBandDateField(parsed.departure_to_date, defaultYear, dateOpts),
    departure_to_time: pickTime(parsed.departure_to_time, parsed.arrival_time),
    departure_baggage_limit: trimOrNull(parsed.departure_baggage_limit),
    arrival_flight_name: arrivalFlight,
    arrival_from_airport: trimOrNull(parsed.arrival_from_airport),
    arrival_to_airport: trimOrNull(parsed.arrival_to_airport),
    arrival_from_date: normalizeBandDateField(parsed.arrival_from_date, defaultYear, dateOpts),
    arrival_from_time: trimOrNull(parsed.arrival_from_time),
    arrival_to_date: normalizeBandDateField(parsed.arrival_to_date, defaultYear, dateOpts),
    arrival_to_time: trimOrNull(parsed.arrival_to_time),
    arrival_baggage_limit: trimOrNull(parsed.arrival_baggage_limit),
    itinerary_v2_json: itineraryV2,
    theme_chart_json: normalizeThemeChartForInsert(parsed.theme_chart_json),
    departure_schedules_json: departureSchedulesJson,
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
