import type { ExternalParsedMeta } from "@/lib/admin/externalImport/externalProductMetaSchema";
import { stripHtmlToText } from "@/lib/admin/externalImport/htmlContextExtract";
import {
  preferTotalPriceOverInstallment,
  stripInstallmentMetaText,
} from "@/lib/admin/externalImport/preferTotalPriceOverInstallment";

const WON_AMOUNT_RE = /(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d{5,})\s*원?/g;
const DURATION_RE = /(\d+)\s*박\s*(\d+)\s*일/;

function resolvePageText(rawHtmlText?: string, cleanHtmlStructure?: string): string {
  const raw = rawHtmlText?.trim();
  if (raw) return stripInstallmentMetaText(raw);
  const html = cleanHtmlStructure?.trim();
  if (html) return stripInstallmentMetaText(stripHtmlToText(html));
  return "";
}

function extractTaggedSection(text: string, tag: string): string | null {
  const marker = `[${tag}]`;
  const idx = text.toLowerCase().indexOf(marker.toLowerCase());
  if (idx < 0) return null;
  const after = text.slice(idx + marker.length).replace(/^\s*\n/, "");
  const block = after.split(/\n{2,}/)[0]?.trim();
  return block || null;
}

function extractTitle(sourceProductTitle: string | null | undefined, pageText: string): string | null {
  const fromSource = sourceProductTitle?.trim();
  if (fromSource) return fromSource;
  return extractTaggedSection(pageText, "og:title");
}

function extractDescription(pageText: string): string | null {
  const fromMeta = extractTaggedSection(pageText, "meta description");
  if (fromMeta) return fromMeta.slice(0, 2000);

  const withoutTags = pageText.replace(/\[[^\]]+\]\s*\n/g, "").trim();
  if (!withoutTags) return null;
  const snippet = withoutTags.split(/\n{2,}/).find((block) => block.trim().length >= 20)?.trim();
  return snippet ? snippet.slice(0, 2000) : withoutTags.slice(0, 2000);
}

function extractDuration(pageText: string): string | null {
  const match = pageText.match(DURATION_RE);
  if (!match) return null;
  return `${match[1]}박 ${match[2]}일`;
}

function parseWonAmounts(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(WON_AMOUNT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 10000) out.push(n);
  }
  return out;
}

function extractPriceFromText(pageText: string): number | null {
  const priceSection = extractTaggedSection(pageText, "가격 정보") ?? pageText;
  const adultLine =
    priceSection
      .split(/\n/)
      .find((line) => /성인\s*1인|1인\s*기준|1인당/.test(line) && /\d/.test(line)) ?? null;

  const scoped = adultLine ?? priceSection;
  const amounts = parseWonAmounts(scoped);
  if (amounts.length === 0) return null;
  const max = Math.max(...amounts);
  return preferTotalPriceOverInstallment(max, pageText);
}

function emptyFlightMeta(): Pick<
  ExternalParsedMeta,
  | "airline_name"
  | "departure_flight_number"
  | "departure_from_airport"
  | "departure_to_airport"
  | "departure_from_date"
  | "departure_from_time"
  | "departure_to_date"
  | "departure_to_time"
  | "departure_duration"
  | "arrival_flight_number"
  | "arrival_from_airport"
  | "arrival_to_airport"
  | "arrival_from_date"
  | "arrival_from_time"
  | "arrival_to_date"
  | "arrival_to_time"
  | "arrival_duration"
  | "departure_time"
  | "arrival_time"
  | "selling_points_json"
> {
  return {
    airline_name: null,
    departure_flight_number: null,
    departure_from_airport: null,
    departure_to_airport: null,
    departure_from_date: null,
    departure_from_time: null,
    departure_to_date: null,
    departure_to_time: null,
    departure_duration: null,
    arrival_flight_number: null,
    arrival_from_airport: null,
    arrival_to_airport: null,
    arrival_from_date: null,
    arrival_from_time: null,
    arrival_to_date: null,
    arrival_to_time: null,
    arrival_duration: null,
    departure_time: null,
    arrival_time: null,
    selling_points_json: null,
  };
}

export function buildLightExternalImportMeta(input: {
  rawHtmlText?: string;
  cleanHtmlStructure?: string;
  sourceProductTitle?: string | null;
  calendarMinPrice?: number | null;
}): ExternalParsedMeta {
  const pageText = resolvePageText(input.rawHtmlText, input.cleanHtmlStructure);
  const title = extractTitle(input.sourceProductTitle, pageText);
  const description = extractDescription(pageText);
  const duration = extractDuration(pageText);
  const textPrice = extractPriceFromText(pageText);
  const price = input.calendarMinPrice ?? textPrice;

  return {
    title,
    seo_hashtags: null,
    one_liner: null,
    meta_description: null,
    description,
    price,
    duration,
    theme: null,
    departure_region: null,
    included_items: null,
    excluded_items: null,
    optional_expenses: null,
    booking_notes: null,
    status: "AVAILABLE",
    ...emptyFlightMeta(),
  };
}

export function canUseLightExternalImport(input: {
  provider: "hanatour" | "modetour" | null;
  sourceProductTitle?: string | null;
  rawHtmlText?: string;
  cleanHtmlStructure?: string;
  hanatourCalendarPayload?: unknown;
}): boolean {
  if (input.provider !== "hanatour") return false;
  const pageText = resolvePageText(input.rawHtmlText, input.cleanHtmlStructure);
  const title = extractTitle(input.sourceProductTitle, pageText);
  return Boolean(title || pageText.length >= 40);
}
