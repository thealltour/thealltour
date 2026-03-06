import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type {
  Product,
  ProductTrust,
  ProductOptions,
  ProductOptionGroup,
  ProductOptionItem,
  ProductOverview,
  ItineraryStructuredDay,
  ItineraryStructuredEvent,
  ItineraryV2,
  ItineraryV2Event,
} from "@/types/product";
import { normalizeImageList } from "@/lib/products/images";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-product/900/560";

export function normalizeProduct(row: Record<string, unknown>): Product {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const sortOrder = typeof row.sort_order === "number" ? row.sort_order : undefined;
  const images = normalizeImageList(
    Array.isArray(row.images_json)
      ? (row.images_json as Array<string | null | undefined>)
      : null,
  );
  const primaryImage = images[0] ?? String(row.image_url ?? row.image ?? FALLBACK_IMAGE);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: primaryImage,
    images_json: images.length > 0 ? images : undefined,
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    price,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    itinerary: typeof row.itinerary === "string" ? row.itinerary : undefined,
    inclusions: typeof row.inclusions === "string" ? row.inclusions : undefined,
    point_benefits: typeof row.point_benefits === "string" ? row.point_benefits : undefined,
    point_tourism: typeof row.point_tourism === "string" ? row.point_tourism : undefined,
    point_guide: typeof row.point_guide === "string" ? row.point_guide : undefined,
    meeting_info: typeof row.meeting_info === "string" ? row.meeting_info : undefined,
    travel_insurance: typeof row.travel_insurance === "string" ? row.travel_insurance : undefined,
    included_items: typeof row.included_items === "string" ? row.included_items : undefined,
    excluded_items: typeof row.excluded_items === "string" ? row.excluded_items : undefined,
    detailed_schedule: typeof row.detailed_schedule === "string" ? row.detailed_schedule : undefined,
    optional_tours: typeof row.optional_tours === "string" ? row.optional_tours : undefined,
    min_departure_people: typeof row.min_departure_people === "string" ? row.min_departure_people : undefined,
    terms_and_notes: typeof row.terms_and_notes === "string" ? row.terms_and_notes : undefined,
    terms_template_type:
      typeof row.terms_template_type === "string" ? row.terms_template_type : undefined,
    departure_from_airport:
      typeof row.departure_from_airport === "string" ? row.departure_from_airport : undefined,
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_from_time:
      typeof row.departure_from_time === "string" ? row.departure_from_time : undefined,
    departure_to_airport:
      typeof row.departure_to_airport === "string" ? row.departure_to_airport : undefined,
    departure_to_date:
      typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    departure_to_time:
      typeof row.departure_to_time === "string" ? row.departure_to_time : undefined,
    departure_flight_name:
      typeof row.departure_flight_name === "string" ? row.departure_flight_name : undefined,
    departure_baggage_limit:
      typeof row.departure_baggage_limit === "string" ? row.departure_baggage_limit : undefined,
    arrival_from_airport:
      typeof row.arrival_from_airport === "string" ? row.arrival_from_airport : undefined,
    arrival_from_date:
      typeof row.arrival_from_date === "string" ? row.arrival_from_date : undefined,
    arrival_from_time:
      typeof row.arrival_from_time === "string" ? row.arrival_from_time : undefined,
    arrival_to_airport:
      typeof row.arrival_to_airport === "string" ? row.arrival_to_airport : undefined,
    arrival_to_date:
      typeof row.arrival_to_date === "string" ? row.arrival_to_date : undefined,
    arrival_to_time:
      typeof row.arrival_to_time === "string" ? row.arrival_to_time : undefined,
    arrival_flight_name:
      typeof row.arrival_flight_name === "string" ? row.arrival_flight_name : undefined,
    arrival_baggage_limit:
      typeof row.arrival_baggage_limit === "string" ? row.arrival_baggage_limit : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    meta_description:
      typeof row.meta_description === "string" ? row.meta_description : undefined,
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    status:
      row.status === "AVAILABLE" ||
      row.status === "LIMITED" ||
      row.status === "SOLD_OUT" ||
      row.status === "CONSULT_REQUIRED"
        ? row.status
        : undefined,
    fuel_included:
      row.fuel_included === true ? true : row.fuel_included === false ? false : undefined,
    price_meta:
      typeof row.price_meta === "string" && row.price_meta.trim() !== ""
        ? row.price_meta.trim()
        : undefined,
    meta_info:
      typeof row.meta_info === "string" && row.meta_info.trim() !== ""
        ? row.meta_info.trim()
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
    one_liner:
      typeof row.one_liner === "string" && row.one_liner.trim() !== ""
        ? row.one_liner.trim()
        : undefined,
    overview_json: normalizeOverview(row.overview_json),
    itinerary_media_json: normalizeItineraryMedia(row.itinerary_media_json),
    itinerary_days_json: normalizeItineraryDays(row.itinerary_days_json),
    itinerary_v2_json: normalizeItineraryV2(row.itinerary_v2_json),
    theme_chart_json: normalizeThemeChartJson(row.theme_chart_json),
    trust: normalizeTrust(row.trust),
    options: normalizeOptions(row.options, typeof row.price === "number" ? row.price : undefined),
  };
}

function normalizeThemeChartJson(raw: unknown): { items: Array<{ label: string; percent: number }> } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const items = o.items;
  if (!Array.isArray(items) || items.length < 2) return undefined;
  const parsed = items
    .filter((i): i is Record<string, unknown> => i != null && typeof i === "object")
    .map((i) => {
      const label = typeof i.label === "string" ? i.label.trim() : "";
      const percent = typeof i.percent === "number" ? i.percent : Number(i.percent);
      return { label, percent: Number.isNaN(percent) ? 0 : Math.max(0, Math.min(100, percent)) };
    })
    .filter((i) => i.label.length > 0);
  return parsed.length >= 2 ? { items: parsed } : undefined;
}

const OVERVIEW_SUMMARY_KINDS = ["flight", "hotel", "region", "theme", "golf", "etc"] as const;

function normalizeItineraryMedia(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(o)) {
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeItineraryDays(raw: unknown): ItineraryStructuredDay[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const days: ItineraryStructuredDay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = typeof o.day === "number" ? o.day : typeof o.day === "string" ? parseInt(o.day, 10) : undefined;
    if (day == null || !Number.isFinite(day) || day < 1) continue;
    const events = Array.isArray(o.events)
      ? (o.events as Array<Record<string, unknown>>)
          .map((e) => {
            const heading = typeof e.heading === "string" ? e.heading.trim() : "";
            if (!heading) return null;
            return {
              heading,
              description:
                typeof e.description === "string" && e.description.trim()
                  ? e.description.trim()
                  : undefined,
              timeOfDay:
                e.timeOfDay === "오전" ||
                e.timeOfDay === "오후" ||
                e.timeOfDay === "저녁" ||
                e.timeOfDay === "종일"
                  ? (e.timeOfDay as ItineraryStructuredEvent["timeOfDay"])
                  : undefined,
              iconKey:
                typeof e.iconKey === "string" && e.iconKey.trim() ? e.iconKey.trim() : undefined,
              images: normalizeEventImages(e.images),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];
    days.push({
      day,
      dateText: typeof o.dateText === "string" && o.dateText.trim() ? o.dateText.trim() : undefined,
      title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined,
      coverImageUrl:
        o.coverImageUrl == null || (typeof o.coverImageUrl === "string" && o.coverImageUrl.trim() === "")
          ? undefined
          : typeof o.coverImageUrl === "string"
            ? o.coverImageUrl.trim()
            : null,
      events,
    });
  }
  return days.length > 0 ? days : undefined;
}

function normalizeEventImages(raw: unknown): ItineraryV2Event["images"] {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" && o.url.trim() ? o.url.trim() : undefined;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    out.push({
      url,
      alt: typeof o.alt === "string" && o.alt.trim() ? o.alt.trim() : undefined,
      sortOrder: typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder) ? o.sortOrder : undefined,
      isCover: o.isCover === true,
    });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeItineraryV2(raw: unknown): ItineraryV2 | undefined {
  if (raw == null) return undefined;
  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return undefined;
      o = parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  } else if (typeof raw === "object") {
    o = raw as Record<string, unknown>;
  } else {
    return undefined;
  }
  const rawDays = Array.isArray(o.days) ? o.days : [];
  if (rawDays.length === 0) return undefined;
  const days: ItineraryV2["days"] = [];
  for (const item of rawDays) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const day = typeof d.day === "number" ? d.day : typeof d.day === "string" ? parseInt(d.day, 10) : undefined;
    if (day == null || !Number.isFinite(day) || day < 1) continue;
    const rawEvents = Array.isArray(d.events) ? d.events : [];
    const events = rawEvents
      .map((e: unknown) => {
        if (!e || typeof e !== "object") return null;
        const ev = e as Record<string, unknown>;
        const heading = typeof ev.heading === "string" ? ev.heading.trim() : "";
        if (!heading) return null;
        return {
          timeOfDay:
            ev.timeOfDay === "오전" ||
            ev.timeOfDay === "오후" ||
            ev.timeOfDay === "저녁" ||
            ev.timeOfDay === "종일"
              ? (ev.timeOfDay as ItineraryV2Event["timeOfDay"])
              : undefined,
          timeText:
            typeof ev.timeText === "string" && ev.timeText.trim() ? ev.timeText.trim() : undefined,
          iconKey:
            typeof ev.iconKey === "string" && ev.iconKey.trim() ? ev.iconKey.trim() : undefined,
          heading,
          description:
            typeof ev.description === "string" && ev.description.trim()
              ? ev.description.trim()
              : undefined,
          location:
            typeof ev.location === "string" && ev.location.trim()
              ? ev.location.trim()
              : undefined,
          order: typeof ev.order === "number" && Number.isFinite(ev.order) ? ev.order : undefined,
          images: normalizeEventImages(ev.images),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    days.push({
      day,
      dateText: typeof d.dateText === "string" && d.dateText.trim() ? d.dateText.trim() : undefined,
      title: typeof d.title === "string" && d.title.trim() ? d.title.trim() : undefined,
      coverImageUrl: typeof d.coverImageUrl === "string" && d.coverImageUrl.trim() ? d.coverImageUrl.trim() : undefined,
      events,
    });
  }
  return days.length > 0 ? { days } : undefined;
}

export function normalizeOverview(raw: unknown): ProductOverview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  // 새 스키마 (enabled, summaryCards with kind, chart, timeline)
  if (typeof o.enabled === "boolean") {
    const summaryCards = Array.isArray(o.summaryCards)
      ? (o.summaryCards as Array<{ kind?: string; label?: string; value?: string }>)
          .filter(
            (c) =>
              c &&
              typeof c.label === "string" &&
              typeof c.value === "string" &&
              OVERVIEW_SUMMARY_KINDS.includes((c.kind ?? "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number]),
          )
          .map((c) => ({
            kind: (OVERVIEW_SUMMARY_KINDS.includes((c.kind ?? "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number])
              ? c.kind
              : "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number],
            label: c.label!,
            value: c.value!,
          }))
      : [];
    const chart =
      o.chart && typeof o.chart === "object"
        ? (() => {
            const ch = o.chart as Record<string, unknown>;
            if (ch.enabled !== true) return undefined;
            const items = Array.isArray(ch.items)
              ? (ch.items as Array<{ label?: string; percent?: number }>)
                  .filter((i) => i && typeof i.label === "string" && typeof i.percent === "number")
                  .map((i) => ({ label: i.label!, percent: i.percent! }))
              : [];
            return items.length > 0 ? { enabled: true, items } : undefined;
          })()
        : undefined;
    const timeline =
      o.timeline && typeof o.timeline === "object"
        ? (() => {
            const tl = o.timeline as Record<string, unknown>;
            if (tl.enabled !== true) return undefined;
            const days = Array.isArray(tl.days)
              ? (tl.days as Array<{ day?: number; dateText?: string; headline?: string; bullets?: unknown }>)
                  .filter(
                    (d) =>
                      d &&
                      typeof d.day === "number" &&
                      Array.isArray(d.bullets) &&
                      (d.bullets as unknown[]).every((b) => typeof b === "string"),
                  )
                  .map((d) => ({
                    day: d.day!,
                    dateText: typeof d.dateText === "string" ? d.dateText : undefined,
                    headline: typeof d.headline === "string" ? d.headline : undefined,
                    bullets: d.bullets as string[],
                  }))
              : [];
            return days.length > 0 ? { enabled: true, days } : undefined;
          })()
        : undefined;
    const coverImageUrl =
      typeof o.coverImageUrl === "string" && o.coverImageUrl.trim() !== "" ? o.coverImageUrl.trim() : undefined;
    const title = typeof o.title === "string" && o.title.trim() !== "" ? o.title.trim() : undefined;
    return {
      enabled: o.enabled,
      title,
      summaryCards,
      coverImageUrl,
      chart,
      timeline,
    };
  }

  // 구 스키마 호환 (summaryCards, themeChart, days) → 새 스키마로 변환
  const legacySummaryCards = Array.isArray(o.summaryCards)
    ? (o.summaryCards as Array<{ label?: string; value?: string }>)
        .filter((c) => c && typeof c.label === "string" && typeof c.value === "string")
        .map((c) => ({ kind: "etc" as const, label: c.label!, value: c.value! }))
    : [];
  const themeChart = o.themeChart && typeof o.themeChart === "object" ? (o.themeChart as Record<string, unknown>) : null;
  const chartItems =
    themeChart && Array.isArray(themeChart.labels) && Array.isArray(themeChart.values)
      ? (themeChart.labels as string[]).map((label, i) => {
          const values = themeChart.values as number[];
          const total = values.reduce((a, b) => a + b, 0);
          const percent = total > 0 ? Math.round(((values[i] ?? 0) / total) * 100) : 0;
          return { label, percent };
        })
      : [];
  const legacyDays = Array.isArray(o.days)
    ? (o.days as Array<{ day?: string; summary?: string }>)
        .filter((d) => d && typeof d.day === "string" && typeof d.summary === "string")
        .map((d) => ({
          day: parseInt(d.day!, 10) || 1,
          bullets: d.summary!.split(/\n/).filter((b) => b.trim()),
        }))
    : [];
  const hasData = legacySummaryCards.length > 0 || chartItems.length > 0 || legacyDays.length > 0;
  if (!hasData) return undefined;
  return {
    enabled: true,
    summaryCards: legacySummaryCards,
    chart: chartItems.length > 0 ? { enabled: true, items: chartItems } : undefined,
    timeline: legacyDays.length > 0 ? { enabled: true, days: legacyDays } : undefined,
  };
}

function normalizeTrust(raw: unknown): ProductTrust | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const recentConsultCount = typeof o.recentConsultCount === "number" ? o.recentConsultCount : undefined;
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

function normalizeOptionItem(raw: unknown): ProductOptionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const value = typeof o.value === "string" ? o.value : typeof o.id === "string" ? o.id : undefined;
  const label = typeof o.label === "string" ? o.label : undefined;
  if (!value || !label) return null;
  return {
    value,
    label,
    priceDelta: typeof o.priceDelta === "number" ? o.priceDelta : undefined,
    meta: typeof o.meta === "string" ? o.meta : undefined,
    isDefault: o.isDefault === true,
  };
}

function normalizeOptionGroup(raw: unknown): ProductOptionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key : typeof o.id === "string" ? o.id : undefined;
  const title = typeof o.title === "string" ? o.title : typeof o.label === "string" ? o.label : undefined;
  const type =
    o.type === "radio" || o.type === "select" || o.type === "stepper" || o.type === "multi"
      ? o.type
      : "radio";
  const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.options) ? o.options : [];
  const items = rawItems.map((item: unknown) => normalizeOptionItem(item)).filter((x): x is ProductOptionItem => x !== null);
  if (!key || !title || items.length === 0) return null;
  return { key, title, type, items };
}

/** 신규: { basePrice, currency, groups }. 레거시: 그룹 배열 → basePrice는 productPrice 사용 */
function normalizeOptions(raw: unknown, productPrice?: number): ProductOptions | undefined {
  const fallbackBase = typeof productPrice === "number" ? productPrice : 0;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const basePrice = typeof o.basePrice === "number" ? o.basePrice : fallbackBase;
    const currency = o.currency === "KRW" ? "KRW" : "KRW";
    const rawGroups = Array.isArray(o.groups) ? o.groups : [];
    const groups = rawGroups.map((g: unknown) => normalizeOptionGroup(g)).filter((x): x is ProductOptionGroup => x !== null);
    const requiredGroups = Array.isArray(o.requiredGroups)
      ? (o.requiredGroups as string[]).filter((k): k is string => typeof k === "string")
      : undefined;
    if (groups.length === 0) return undefined;
    return { basePrice, currency, requiredGroups, groups };
  }

  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const legacyGroups = raw.map((item: unknown) => normalizeOptionGroup(item)).filter((x): x is ProductOptionGroup => x !== null);
  if (legacyGroups.length === 0) return undefined;
  const requiredKeys = (raw as Record<string, unknown>[])
    .filter((r) => r.required === true)
    .map((r) => (typeof r.key === "string" ? r.key : typeof r.id === "string" ? r.id : null))
    .filter((k): k is string => k != null);
  return {
    basePrice: fallbackBase,
    currency: "KRW",
    requiredGroups: requiredKeys.length > 0 ? requiredKeys : undefined,
    groups: legacyGroups,
  };
}

/** 패키지상품 목록용: is_active인 전체 상품 (추천 여부 무관) */
export async function getProducts() {
  return getProductsCached();
}

const getProductsCached = unstable_cache(
  async () => {
  const advancedQuery = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (!advancedQuery.error) {
    return (advancedQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  }

  const fallbackQuery = await supabase.from("products").select("*");
  if (fallbackQuery.error) {
    console.error("[products] list fetch error:", fallbackQuery.error.message);
    return [] as Product[];
  }

  return (fallbackQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  },
  ["products:list"],
  { revalidate: 60, tags: ["products"] },
);

export async function getProductById(id: string) {
  return getProductByIdCached(id);
}

/** 상세 페이지용: 캐시 없이 항상 최신 데이터 조회 (수정 저장 후 즉시 반영) */
export async function getProductByIdFresh(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeProduct(data as Record<string, unknown>);
}

const getProductByIdCached = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeProduct(data as Record<string, unknown>);
  },
  ["products:by-id"],
  { revalidate: 120, tags: ["products"] },
);
