import {
  DEFAULT_FLYER_LAYOUT_OPTIONS,
  DEFAULT_FLYER_TEMPLATE_KEY,
  FLYER_MAX_GALLERY_IMAGES,
  FLYER_SECTION_KEYS,
  type FlyerDraftApiRecord,
  type FlyerDraftRow,
  type FlyerDraftState,
  type FlyerEditableFields,
  type FlyerLayoutOptions,
  type FlyerSectionToggles,
  type FlyerTemplateKey,
} from "@/lib/flyers/flyer.types";
import type { FlyerOutfitChecklistItem, FlyerOutfitDraftState } from "@/lib/flyers/weather/flyerOutfit.types";
import { EMPTY_FLYER_OUTFIT_DRAFT } from "@/lib/flyers/weather/flyerOutfit.types";
import type { FlyerWeatherDay, FlyerWeatherDraftState } from "@/lib/flyers/weather/flyerWeather.types";
import { EMPTY_FLYER_WEATHER_DRAFT } from "@/lib/flyers/weather/flyerWeather.types";

const EMPTY_FIELDS: FlyerEditableFields = {
  title: "",
  subtitle: "",
  departureText: "",
  meetingText: "",
  airlineText: "",
  baggageTitle: "",
  baggageLines: [],
  preparationTitle: "",
  preparationLines: [],
  includedTitle: "",
  includedLines: [],
  excludedTitle: "",
  excludedLines: [],
  noticeText: "",
  weatherTitle: "",
  weatherSummary: "",
  footerBrandText: "",
  footerInfoText: "",
};

const FLYER_TEMPLATE_KEYS = new Set<FlyerTemplateKey>([
  "longform-default",
  "longform-visual",
  "a4-portrait-default",
  "a4-portrait-compact",
  "a4-portrait-visual",
]);

export function normalizeFlyerTemplateKey(raw: string | null | undefined): FlyerTemplateKey {
  const k = raw?.trim();
  if (k && FLYER_TEMPLATE_KEYS.has(k as FlyerTemplateKey)) return k as FlyerTemplateKey;
  return DEFAULT_FLYER_TEMPLATE_KEY;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseSectionToggles(raw: unknown): FlyerSectionToggles {
  const o = isRecord(raw) ? raw : {};
  const next = {} as FlyerSectionToggles;
  for (const key of FLYER_SECTION_KEYS) {
    if (typeof o[key] === "boolean") {
      next[key] = o[key];
    } else {
      next[key] = key === "includedExcluded" ? false : true;
    }
  }
  return next;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim());
}

export function parseEditableFields(raw: unknown): FlyerEditableFields {
  if (!isRecord(raw)) return { ...EMPTY_FIELDS };
  const r = raw;
  const str = (k: keyof FlyerEditableFields): string =>
    typeof r[k] === "string" ? (r[k] as string) : "";
  return {
    title: str("title"),
    subtitle: str("subtitle"),
    departureText: str("departureText"),
    meetingText: str("meetingText"),
    airlineText: str("airlineText"),
    baggageTitle: str("baggageTitle"),
    baggageLines: parseStringArray(r.baggageLines),
    preparationTitle: str("preparationTitle"),
    preparationLines: parseStringArray(r.preparationLines),
    includedTitle: str("includedTitle"),
    includedLines: parseStringArray(r.includedLines),
    excludedTitle: str("excludedTitle"),
    excludedLines: parseStringArray(r.excludedLines),
    noticeText: str("noticeText"),
    weatherTitle: str("weatherTitle"),
    weatherSummary: str("weatherSummary"),
    footerBrandText: str("footerBrandText"),
    footerInfoText: str("footerInfoText"),
  };
}

function parseFlyerWeatherDay(item: unknown): FlyerWeatherDay | null {
  if (!isRecord(item)) return null;
  const date = typeof item.date === "string" ? item.date.trim() : "";
  if (!date) return null;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    date,
    minC: numOrNull(item.minC),
    maxC: numOrNull(item.maxC),
    condition: typeof item.condition === "string" ? item.condition : "",
    chanceOfRain: numOrNull(item.chanceOfRain),
  };
}

/** fields_json 전체 또는 API body의 `weather` 객체에서 복원 */
export function parseFlyerWeatherDraft(raw: unknown): FlyerWeatherDraftState {
  const w = isRecord(raw) && isRecord(raw.weather) ? raw.weather : isRecord(raw) ? raw : null;
  if (!w) return { ...EMPTY_FLYER_WEATHER_DRAFT };

  const daysRaw = w.days;
  const days: FlyerWeatherDay[] = [];
  if (Array.isArray(daysRaw)) {
    for (const row of daysRaw) {
      const d = parseFlyerWeatherDay(row);
      if (d) days.push(d);
    }
  }

  return {
    city: typeof w.city === "string" ? w.city : "",
    startDate: typeof w.startDate === "string" ? w.startDate : "",
    endDate: typeof w.endDate === "string" ? w.endDate : "",
    days,
    summaryText: typeof w.summaryText === "string" ? w.summaryText : "",
    isLoaded: w.isLoaded === true,
  };
}

export function parseFlyerOutfitDraft(raw: unknown): FlyerOutfitDraftState {
  if (!isRecord(raw)) return { ...EMPTY_FLYER_OUTFIT_DRAFT };
  /** fields_json 루트의 `outfit` 또는 API body에서 곧바로 넘긴 outfit 객체 */
  const o: Record<string, unknown> = isRecord(raw.outfit) ? (raw.outfit as Record<string, unknown>) : raw;

  const items: FlyerOutfitChecklistItem[] = [];
  const itemsRaw = o.items;
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      if (typeof row === "string" && row.trim()) {
        items.push({ text: row.trim(), included: true });
      } else if (isRecord(row) && typeof row.text === "string" && row.text.trim()) {
        items.push({
          text: row.text.trim(),
          included: row.included !== false,
        });
      }
    }
  }

  const tagsRaw = o.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
    : undefined;

  return {
    items,
    summaryText: typeof o.summaryText === "string" ? o.summaryText : "",
    isAutoGenerated: o.isAutoGenerated === true,
    tags: tags?.length ? tags : undefined,
  };
}

export function parseLayoutOptions(raw: unknown): FlyerLayoutOptions {
  if (!isRecord(raw)) return { ...DEFAULT_FLYER_LAYOUT_OPTIONS };
  const r = raw;
  return {
    compactMode: typeof r.compactMode === "boolean" ? r.compactMode : DEFAULT_FLYER_LAYOUT_OPTIONS.compactMode,
    imageDensity: r.imageDensity === "compact" ? "compact" : "normal",
    spacingMode: r.spacingMode === "tight" ? "tight" : "normal",
  };
}

/** PATCH 등 부분 업데이트: 누락 필드는 base 유지 */
export function mergeLayoutOptions(base: FlyerLayoutOptions, patch: unknown): FlyerLayoutOptions {
  if (!isRecord(patch)) return { ...base };
  const r = patch;
  return {
    compactMode: typeof r.compactMode === "boolean" ? r.compactMode : base.compactMode,
    imageDensity: r.imageDensity === "compact" ? "compact" : r.imageDensity === "normal" ? "normal" : base.imageDensity,
    spacingMode: r.spacingMode === "tight" ? "tight" : r.spacingMode === "normal" ? "normal" : base.spacingMode,
  };
}

/** DB/ API에서 완전한 FlyerDraftState 복원 */
export function flyerDraftStateFromRowParts(
  sectionsJson: unknown,
  fieldsJson: unknown,
  imageUrlsJson: unknown,
  templateKeyRaw?: string | null,
  layoutOptionsJson?: unknown,
): FlyerDraftState {
  return {
    templateKey: normalizeFlyerTemplateKey(templateKeyRaw),
    layoutOptions: parseLayoutOptions(layoutOptionsJson),
    sections: parseSectionToggles(sectionsJson),
    fields: parseEditableFields(fieldsJson),
    weather: parseFlyerWeatherDraft(fieldsJson),
    outfit: parseFlyerOutfitDraft(fieldsJson),
    selectedImageUrls: parseStringArray(imageUrlsJson).slice(0, FLYER_MAX_GALLERY_IMAGES),
  };
}

export function flyerDraftStateToDbPayload(state: FlyerDraftState): {
  sections_json: FlyerSectionToggles;
  fields_json: Record<string, unknown>;
  image_urls_json: string[];
  layout_options_json: FlyerLayoutOptions;
  title: string;
  subtitle: string;
} {
  return {
    sections_json: state.sections,
    fields_json: { ...state.fields, weather: state.weather, outfit: state.outfit },
    image_urls_json: state.selectedImageUrls.slice(0, FLYER_MAX_GALLERY_IMAGES),
    layout_options_json: state.layoutOptions,
    title: state.fields.title?.trim() || "",
    subtitle: state.fields.subtitle?.trim() || "",
  };
}

export function mapFlyerRowToApi(row: FlyerDraftRow): FlyerDraftApiRecord {
  const draft = flyerDraftStateFromRowParts(
    row.sections_json,
    row.fields_json,
    row.image_urls_json,
    row.template_key,
    row.layout_options_json,
  );
  return {
    id: row.id,
    productId: row.product_id,
    templateKey: draft.templateKey,
    layoutOptions: draft.layoutOptions,
    title: row.title,
    subtitle: row.subtitle,
    sections: draft.sections,
    fields: draft.fields,
    weather: draft.weather,
    outfit: draft.outfit,
    imageUrls: draft.selectedImageUrls,
    previewVersion: row.preview_version,
    pngFileUrl: row.png_file_url,
    shareSlug: row.share_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildAdminFlyerUrl(origin: string, draftId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/theall_manager_only/flyers/${draftId}`;
}

export function coerceFlyerDraftRow(raw: Record<string, unknown>): FlyerDraftRow | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const product_id = typeof raw.product_id === "string" ? raw.product_id : null;
  if (!id || !product_id) return null;
  return {
    id,
    product_id,
    template_key: typeof raw.template_key === "string" ? raw.template_key : DEFAULT_FLYER_TEMPLATE_KEY,
    layout_options_json: raw.layout_options_json ?? {},
    title: typeof raw.title === "string" ? raw.title : null,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : null,
    sections_json: raw.sections_json,
    fields_json: raw.fields_json,
    image_urls_json: raw.image_urls_json,
    preview_version: typeof raw.preview_version === "number" ? raw.preview_version : 1,
    png_file_url: typeof raw.png_file_url === "string" ? raw.png_file_url : null,
    share_slug: typeof raw.share_slug === "string" ? raw.share_slug : null,
    created_by: typeof raw.created_by === "string" ? raw.created_by : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
  };
}
