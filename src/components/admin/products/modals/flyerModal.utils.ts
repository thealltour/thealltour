import type { Product } from "@/types/product";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import type { FlyerDraftState, FlyerSectionToggles } from "@/lib/flyers/flyer.types";
import { DEFAULT_FLYER_LAYOUT_OPTIONS, DEFAULT_FLYER_TEMPLATE_KEY, FLYER_SECTION_KEYS } from "@/lib/flyers/flyer.types";
import {
  mergeLayoutOptions,
  normalizeFlyerTemplateKey,
  parseFlyerOutfitDraft,
  parseFlyerWeatherDraft,
} from "@/lib/flyers/serializeFlyerDraft";
import { EMPTY_FLYER_OUTFIT_DRAFT } from "@/lib/flyers/weather/flyerOutfit.types";
import { EMPTY_FLYER_WEATHER_DRAFT } from "@/lib/flyers/weather/flyerWeather.types";
import {
  defaultNoticeForProduct,
  FLYER_DEFAULT_BAGGAGE_LINES,
  FLYER_DEFAULT_BAGGAGE_TITLE,
  FLYER_DEFAULT_EXCLUDED_TITLE,
  FLYER_DEFAULT_FOOTER_BRAND,
  FLYER_DEFAULT_FOOTER_INFO,
  FLYER_DEFAULT_INCLUDED_TITLE,
  FLYER_DEFAULT_MEETING_PLACEHOLDER,
  FLYER_DEFAULT_PREPARATION_LINES,
  FLYER_DEFAULT_PREPARATION_TITLE,
  FLYER_DEFAULT_WEATHER_SUMMARY,
  FLYER_DEFAULT_WEATHER_TITLE,
} from "./flyerDefaults";

/** 대표 이미지 우선, 이후 images_json 순 — 유인물 후보 URL (중복 제거) */
export function collectFlyerCandidateImageUrls(product: Product): string[] {
  const hero = getPrimaryImageUrl(product);
  const list = normalizeImageList(product.images_json);
  const merged: string[] = [];
  const pushU = (u: string) => {
    const n = normalizeProductImageUrl(u.trim()) || u.trim();
    if (n && !merged.includes(n)) merged.push(n);
  };
  if (hero) pushU(hero);
  for (const u of list) pushU(u);
  return merged;
}

/** 줄바꿈·쉼표·불릿(·, -, *) 기준으로 나누어 배열화 (과도한 정제 없음) */
export function splitLinesLoose(raw: string): string[] {
  if (!raw?.trim()) return [];
  const normalized = raw.replace(/\r\n/g, "\n");
  const byNl = normalized.split(/\n/).flatMap((line) => {
    const t = line.trim();
    if (!t) return [];
    if (/^[·•\-\*]\s?/.test(t)) return [t.replace(/^[·•\-\*]\s?/, "").trim()].filter(Boolean);
    return [t];
  });
  if (byNl.length > 1) return byNl.filter((l) => l.length > 0);
  return normalized
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function linesToMultiline(lines: string[]): string {
  return lines.join("\n");
}

export function multilineToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function allSectionsTrue(): FlyerSectionToggles {
  const o = {} as FlyerSectionToggles;
  for (const k of FLYER_SECTION_KEYS) o[k] = true;
  return o;
}

function buildSubtitle(product: Product): string {
  const parts: string[] = [];
  const region = product.overview_region?.trim();
  if (region) parts.push(region);
  const cat = product.category?.trim();
  if (cat && !parts.includes(cat)) parts.push(cat);
  const theme = product.theme?.trim();
  if (theme && !parts.includes(theme)) parts.push(theme);
  const dur = product.duration?.trim() || product.overview_duration?.trim();
  if (dur) parts.push(dur);
  return parts.slice(0, 4).join(" · ") || "";
}

function buildDepartureText(product: Product): string {
  const chunks: string[] = [];
  const dep = product.departure?.trim();
  if (dep) chunks.push(`출발지: ${dep}`);
  const d = product.departure_from_date?.trim();
  const t = product.departure_from_time?.trim();
  if (d || t) {
    chunks.push(`출발 일시: ${[d, t].filter(Boolean).join(" ")}`.trim());
  }
  const arr = product.departures?.filter(Boolean) ?? [];
  if (arr.length > 0) {
    chunks.push(`출발일 옵션: ${arr.slice(0, 3).join(", ")}${arr.length > 3 ? " …" : ""}`);
  }
  return chunks.join("\n");
}

function buildAirlineText(product: Product): string {
  const flight = product.departure_flight_name?.trim();
  if (flight) return `출발편: ${flight}`;
  const airline = product.airline?.trim();
  if (airline) return airline;
  return "";
}

function normalizeProductDateYmd(raw: string | undefined | null): string {
  const t = raw?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** duration / overview_duration 문자열에서 여행 일수(달력상) 추정 (최대 14) */
export function estimateTripSpanDays(product: Product): number {
  const raw = (product.duration?.trim() || product.overview_duration?.trim() || "").toLowerCase();
  const mNight = raw.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (mNight) {
    const days = parseInt(mNight[2], 10);
    if (Number.isFinite(days) && days > 0) return Math.min(14, days);
    const nights = parseInt(mNight[1], 10);
    if (Number.isFinite(nights) && nights > 0) return Math.min(14, nights + 1);
  }
  const mDay = raw.match(/(\d+)\s*일/);
  if (mDay) {
    const d = parseInt(mDay[1], 10);
    if (Number.isFinite(d) && d > 0) return Math.min(14, d);
  }
  return 4;
}

function addDaysYmd(ymd: string, add: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + add);
  return dt.toISOString().slice(0, 10);
}

/** 날씨 조회용 도시·일정 프리필 (상품 메타 부족 시 빈 값 — 수동 입력) */
export function buildFlyerWeatherPrefill(product: Product): FlyerDraftState["weather"] {
  const city =
    product.overview_region?.trim() ||
    product.theme?.trim() ||
    product.category?.trim() ||
    "";
  const start =
    normalizeProductDateYmd(product.departure_from_date) ||
    normalizeProductDateYmd(product.departures?.[0]) ||
    "";
  let end = normalizeProductDateYmd(product.departure_to_date);
  if (start && !end) {
    const span = estimateTripSpanDays(product);
    end = addDaysYmd(start, Math.max(0, span - 1));
  }
  return {
    ...EMPTY_FLYER_WEATHER_DRAFT,
    city,
    startDate: start,
    endDate: end,
  };
}

export function buildInitialFlyerDraft(product: Product): FlyerDraftState {
  const { resolvedIncludedItems, resolvedExcludedItems } = resolveProductDetailBodyFields(product);

  const merged = collectFlyerCandidateImageUrls(product);
  const selectedImageUrls = merged.slice(0, 4);

  return {
    templateKey: DEFAULT_FLYER_TEMPLATE_KEY,
    layoutOptions: { ...DEFAULT_FLYER_LAYOUT_OPTIONS },
    sections: allSectionsTrue(),
    fields: {
      title: product.title?.trim() || "(제목 없음)",
      subtitle: buildSubtitle(product),
      departureText: buildDepartureText(product),
      meetingText: FLYER_DEFAULT_MEETING_PLACEHOLDER,
      airlineText: buildAirlineText(product),
      baggageTitle: FLYER_DEFAULT_BAGGAGE_TITLE,
      baggageLines: [...FLYER_DEFAULT_BAGGAGE_LINES],
      preparationTitle: FLYER_DEFAULT_PREPARATION_TITLE,
      preparationLines: [...FLYER_DEFAULT_PREPARATION_LINES],
      includedTitle: FLYER_DEFAULT_INCLUDED_TITLE,
      includedLines: splitLinesLoose(resolvedIncludedItems),
      excludedTitle: FLYER_DEFAULT_EXCLUDED_TITLE,
      excludedLines: splitLinesLoose(resolvedExcludedItems),
      noticeText: defaultNoticeForProduct(product),
      weatherTitle: FLYER_DEFAULT_WEATHER_TITLE,
      weatherSummary: FLYER_DEFAULT_WEATHER_SUMMARY,
      footerBrandText: FLYER_DEFAULT_FOOTER_BRAND,
      footerInfoText: FLYER_DEFAULT_FOOTER_INFO,
    },
    weather: buildFlyerWeatherPrefill(product),
    outfit: { ...EMPTY_FLYER_OUTFIT_DRAFT },
    selectedImageUrls,
  };
}

export function setAllSections(sections: FlyerSectionToggles, value: boolean): FlyerSectionToggles {
  const next = { ...sections };
  for (const k of FLYER_SECTION_KEYS) next[k] = value;
  return next;
}

/** 저장본·캐시 등 불완전한 draft를 안전히 FlyerDraftState로 맞춤 */
export function normalizePersistedFlyerDraft(input: Partial<FlyerDraftState> | FlyerDraftState, product: Product): FlyerDraftState {
  const base = buildInitialFlyerDraft(product);
  return {
    templateKey: normalizeFlyerTemplateKey(
      typeof input.templateKey === "string" ? input.templateKey : base.templateKey,
    ),
    layoutOptions: mergeLayoutOptions(base.layoutOptions, input.layoutOptions ?? {}),
    sections: { ...base.sections, ...(input.sections ?? {}) },
    fields: { ...base.fields, ...input.fields },
    weather:
      input.weather !== undefined ? parseFlyerWeatherDraft(input.weather) : base.weather,
    outfit: input.outfit !== undefined ? parseFlyerOutfitDraft(input.outfit) : base.outfit,
    selectedImageUrls: (() => {
      const raw = input.selectedImageUrls?.filter(Boolean) ?? [];
      return (raw.length > 0 ? raw : base.selectedImageUrls).slice(0, 4);
    })(),
  };
}
