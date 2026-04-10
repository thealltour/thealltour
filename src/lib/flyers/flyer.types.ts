/**
 * 유인물 draft 도메인·API 타입 (UI state와 DB row 분리)
 */

import type { FlyerOutfitDraftState } from "@/lib/flyers/weather/flyerOutfit.types";
import type { FlyerWeatherDraftState } from "@/lib/flyers/weather/flyerWeather.types";

export type { FlyerWeatherDay, FlyerWeatherDraftState } from "@/lib/flyers/weather/flyerWeather.types";
export { EMPTY_FLYER_WEATHER_DRAFT } from "@/lib/flyers/weather/flyerWeather.types";
export type { FlyerOutfitChecklistItem, FlyerOutfitDraftState } from "@/lib/flyers/weather/flyerOutfit.types";
export { EMPTY_FLYER_OUTFIT_DRAFT } from "@/lib/flyers/weather/flyerOutfit.types";

export type FlyerSectionKey =
  | "header"
  | "departure"
  | "baggage"
  | "preparation"
  | "includedExcluded"
  | "notice"
  | "weather"
  | "gallery"
  | "footer";

export type FlyerSectionToggles = Record<FlyerSectionKey, boolean>;

/** 저장·공개 페이지에서 동일하게 사용 (레거시 a4-portrait-* 는 DB 호환용으로 유지) */
export type FlyerTemplateKey =
  | "longform-default"
  | "longform-visual"
  | "a4-portrait-default"
  | "a4-portrait-compact"
  | "a4-portrait-visual";

/** DB 등에 남아 있는 A4 전용 키 */
export function isLegacyA4FlyerTemplate(templateKey: FlyerTemplateKey): boolean {
  return (
    templateKey === "a4-portrait-default" ||
    templateKey === "a4-portrait-compact" ||
    templateKey === "a4-portrait-visual"
  );
}

/** 상단 히어로·비주얼 강조 레이아웃 (구 a4-portrait-visual 포함) */
export function isFlyerTemplateVisualVariant(templateKey: FlyerTemplateKey): boolean {
  return templateKey === "longform-visual" || templateKey === "a4-portrait-visual";
}

export type FlyerLayoutOptions = {
  /** 여백·타이포 소폭 축소 (인쇄물에 반영) */
  compactMode: boolean;
  /** 갤러리 셀·열 비중 */
  imageDensity: "normal" | "compact";
  /** 섹션 간 간격 */
  spacingMode: "normal" | "tight";
};

export const DEFAULT_FLYER_TEMPLATE_KEY: FlyerTemplateKey = "longform-default";

export const DEFAULT_FLYER_LAYOUT_OPTIONS: FlyerLayoutOptions = {
  compactMode: false,
  imageDensity: "normal",
  spacingMode: "normal",
};

export type FlyerEditableFields = {
  title: string;
  subtitle: string;
  departureText: string;
  meetingText: string;
  airlineText: string;
  baggageTitle: string;
  baggageLines: string[];
  preparationTitle: string;
  preparationLines: string[];
  includedTitle: string;
  includedLines: string[];
  excludedTitle: string;
  excludedLines: string[];
  noticeText: string;
  weatherTitle: string;
  weatherSummary: string;
  footerBrandText: string;
  footerInfoText: string;
};

export type FlyerDraftState = {
  templateKey: FlyerTemplateKey;
  layoutOptions: FlyerLayoutOptions;
  sections: FlyerSectionToggles;
  fields: FlyerEditableFields;
  /** 조회 메타·일별 요약 (fields_json 내 `weather` 키로 저장) */
  weather: FlyerWeatherDraftState;
  /** 날씨 기반 복장·준비물 체크리스트 (fields_json `outfit`) */
  outfit: FlyerOutfitDraftState;
  selectedImageUrls: string[];
};

export const FLYER_SECTION_KEYS: FlyerSectionKey[] = [
  "header",
  "departure",
  "baggage",
  "preparation",
  "includedExcluded",
  "notice",
  "weather",
  "gallery",
  "footer",
];

export const FLYER_SECTION_LABELS: Record<FlyerSectionKey, string> = {
  header: "헤더 (제목·부제)",
  departure: "출발·일정 안내",
  baggage: "수하물·기내 반입",
  preparation: "준비물",
  includedExcluded: "포함 / 불포함",
  notice: "유의사항",
  weather: "날씨·현지 안내",
  gallery: "이미지 갤러리",
  footer: "하단 브랜딩",
};

/** DB snake_case row (Supabase) */
export type FlyerDraftRow = {
  id: string;
  product_id: string;
  template_key: string;
  layout_options_json: unknown;
  title: string | null;
  subtitle: string | null;
  sections_json: unknown;
  fields_json: unknown;
  image_urls_json: unknown;
  preview_version: number;
  png_file_url: string | null;
  share_slug: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveFlyerDraftPayload = {
  productId: string;
  templateKey?: string;
  layoutOptions?: FlyerLayoutOptions;
  sections: FlyerSectionToggles;
  fields: FlyerEditableFields;
  weather?: FlyerWeatherDraftState;
  outfit?: FlyerOutfitDraftState;
  imageUrls: string[];
};

export type PatchFlyerDraftPayload = {
  templateKey?: string;
  layoutOptions?: FlyerLayoutOptions;
  sections?: FlyerSectionToggles;
  fields?: FlyerEditableFields;
  weather?: FlyerWeatherDraftState;
  outfit?: FlyerOutfitDraftState;
  imageUrls?: string[];
  pngFileUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  previewVersion?: number;
};

export type FlyerDraftApiRecord = {
  id: string;
  productId: string;
  templateKey: string;
  layoutOptions: FlyerLayoutOptions;
  title: string | null;
  subtitle: string | null;
  sections: FlyerSectionToggles;
  fields: FlyerEditableFields;
  weather: FlyerWeatherDraftState;
  outfit: FlyerOutfitDraftState;
  imageUrls: string[];
  previewVersion: number;
  pngFileUrl: string | null;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveFlyerDraftResponse = {
  ok: true;
  draft: FlyerDraftApiRecord;
  adminUrl: string;
};

export type FlyerDraftApiError = {
  ok: false;
  message: string;
};

/** /flyers/[id]에서 모달 부트스트랩 */
export type FlyerPersistedBootstrap = {
  id: string;
  shareSlug: string;
  updatedAt: string;
  draft: FlyerDraftState;
};
