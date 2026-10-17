import {
  TRAVELPAYOUTS_PUBLIC_SHMARKER,
  TRAVELPAYOUTS_PUBLIC_TRS,
} from "@/lib/affiliate/travelPayoutsConfig";

/**
 * Travelpayouts widget embed URLs (client-safe, pure). Parameters below were generated in the
 * Travelpayouts dashboard; only IDs from the discovery DTO vary. Never accepts a URL as input.
 */
export const TP_WIDGET_ORIGIN = "https://tpwdgt.com";
const TP_WIDGET_PATH = "/content";

/** Product IDs per Tiqets widget (backend caps at the same value; extras are dropped in order). */
export const TIQETS_WIDGET_MAX_PRODUCTS = 3;

export const TIQETS_PRODUCT_WIDGET_SETTINGS = {
  currency: "USD",
  language: "en",
  layout: "horizontal",
  campaignId: "89",
  promoId: "3948",
} as const;

export const KLOOK_CITY_WIDGET_SETTINGS = {
  currency: "KRW",
  locale: "ko_KR",
  amount: 3,
  campaignId: "137",
  promoId: "4497",
} as const;

const NUMERIC_ID = /^[1-9]\d{0,11}$/;

function widgetUrl(params: Array<[string, string]>): string {
  const url = new URL(TP_WIDGET_PATH, TP_WIDGET_ORIGIN);
  for (const [key, value] of params) url.searchParams.set(key, value);
  return url.toString();
}

/** Valid, deduped product IDs in backend priority order (max 3); any non-numeric ID → null. */
export function normalizeTiqetsWidgetProductIds(productIds: readonly string[]): string[] | null {
  const ids: string[] = [];
  for (const raw of productIds) {
    if (typeof raw !== "string" || !NUMERIC_ID.test(raw)) return null;
    if (!ids.includes(raw)) ids.push(raw);
  }
  return ids.length > 0 ? ids.slice(0, TIQETS_WIDGET_MAX_PRODUCTS) : null;
}

export function buildTiqetsWidgetSrc(params: { productIds: readonly string[] }): string | null {
  const ids = normalizeTiqetsWidgetProductIds(params.productIds);
  if (!ids) return null;
  const s = TIQETS_PRODUCT_WIDGET_SETTINGS;
  return widgetUrl([
    ["currency", s.currency],
    ["trs", TRAVELPAYOUTS_PUBLIC_TRS],
    ["shmarker", TRAVELPAYOUTS_PUBLIC_SHMARKER],
    ["product", ids.join(",")],
    ["language", s.language],
    ["layout", s.layout],
    ["powered_by", "true"],
    ["campaign_id", s.campaignId],
    ["promo_id", s.promoId],
  ]);
}

export function buildKlookWidgetSrc(params: {
  cityId: string | null | undefined;
  categoryId: string | null | undefined;
}): string | null {
  const { cityId, categoryId } = params;
  if (!cityId || !NUMERIC_ID.test(cityId)) return null;
  if (!categoryId || !NUMERIC_ID.test(categoryId)) return null;
  const s = KLOOK_CITY_WIDGET_SETTINGS;
  return widgetUrl([
    ["currency", s.currency],
    ["trs", TRAVELPAYOUTS_PUBLIC_TRS],
    ["shmarker", TRAVELPAYOUTS_PUBLIC_SHMARKER],
    ["locale", s.locale],
    ["city_id", cityId],
    ["category", categoryId],
    ["amount", String(s.amount)],
    ["powered_by", "true"],
    ["campaign_id", s.campaignId],
    ["promo_id", s.promoId],
  ]);
}

/** Only our own embed endpoint may be injected as a script. */
export function isTpWidgetSrc(src: string): boolean {
  try {
    const url = new URL(src);
    return url.origin === TP_WIDGET_ORIGIN && url.pathname === TP_WIDGET_PATH;
  } catch {
    return false;
  }
}
