import { asInteger, asNumber, asRecord, asString } from "@/lib/marketing/context/json";
import type { ProductContext, TaxonomyContext } from "@/lib/marketing/context/types";
import {
  PRODUCT_MEMORY_CONFIDENCE,
  PRODUCT_MEMORY_IMPORTANCE_ACTIVE,
  PRODUCT_MEMORY_IMPORTANCE_INACTIVE,
  PRODUCT_MEMORY_SOURCE_TYPE,
  PRODUCT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { normalizeMemoryText } from "@/lib/marketing/memory/normalization";
import type { MemoryDocument } from "@/lib/marketing/memory/types";

const MAX_ITINERARY_DAYS = 12;
const MAX_EVENTS_PER_DAY = 4;
const MAX_DEPARTURES = 8;
const MAX_ITINERARY_TEXT_CHARS = 1500;

const SELLING_POINT_LABELS = [
  ["corePoints", "핵심"],
  ["tourism", "관광"],
  ["meals", "식사"],
  ["transport", "교통"],
  ["insurance", "보험"],
] as const;

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return normalizeMemoryText(text) || null;
}

function taxonomyLabel(taxonomy: TaxonomyContext | null): string | null {
  if (!taxonomy) return null;
  return taxonomy.displayLabel || taxonomy.name || null;
}

function line(label: string, value: string | null | undefined): string | null {
  const text = stripHtml(value);
  return text ? `${label}: ${text}` : null;
}

function bulletSection(label: string, items: string[]): string | null {
  const cleaned = items.map((item) => stripHtml(item)).filter((item): item is string => Boolean(item));
  if (cleaned.length === 0) return null;
  return `${label}:\n${cleaned.map((item) => `- ${item}`).join("\n")}`;
}

function splitBlocks(value: string | null | undefined): string[] {
  const text = stripHtml(value);
  if (!text) return [];
  const parts = text
    .split(/\n+/)
    .map((part) => part.replace(/^[-*•·]\s*/, "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function asObjectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.days)) {
    return record.days.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }
  if (Array.isArray(record.schedules)) {
    return record.schedules.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }
  return [];
}

function eventHeading(event: Record<string, unknown>): string | null {
  const heading = asString(event.heading);
  const location = asString(event.location);
  if (heading && location) return `${heading} (${location})`;
  return heading;
}

function flattenItineraryDays(value: unknown): string[] {
  const days = asObjectList(value).slice(0, MAX_ITINERARY_DAYS);
  const lines: string[] = [];
  for (const day of days) {
    const number = asInteger(day.day);
    const title = asString(day.title) ?? asString(day.subtitle);
    const events = Array.isArray(day.events)
      ? day.events
          .filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
          .map(eventHeading)
          .filter((item): item is string => Boolean(item))
          .slice(0, MAX_EVENTS_PER_DAY)
      : [];
    const description = events.length === 0 ? stripHtml(asString(day.description)) : null;
    const prefix = number != null ? `Day ${number}` : "Day";
    const head = title ? `${prefix} ${title}` : prefix;
    if (events.length > 0) {
      lines.push(`${head}: ${events.join(" / ")}`);
    } else if (description) {
      lines.push(`${head}: ${description}`);
    } else if (title) {
      lines.push(head);
    }
  }
  return lines;
}

function flattenItinerary(product: ProductContext): string[] {
  const fromV2 = flattenItineraryDays(product.itineraryV2);
  if (fromV2.length > 0) return fromV2;
  const fromDays = flattenItineraryDays(product.itineraryDays);
  if (fromDays.length > 0) return fromDays;
  const itinerary = stripHtml(product.itinerary);
  if (itinerary) {
    return [itinerary.length > MAX_ITINERARY_TEXT_CHARS ? itinerary.slice(0, MAX_ITINERARY_TEXT_CHARS) : itinerary];
  }
  const detailed = stripHtml(product.detailedSchedule);
  if (detailed) {
    return [detailed.length > MAX_ITINERARY_TEXT_CHARS ? detailed.slice(0, MAX_ITINERARY_TEXT_CHARS) : detailed];
  }
  return [];
}

function flattenDepartures(value: unknown): string[] {
  const lines: string[] = [];
  for (const item of asObjectList(value).slice(0, MAX_DEPARTURES)) {
    const label =
      asString(item.label) ?? asString(item.departureDate) ?? asString(item.departure_date);
    if (!label) continue;
    const returnDate = asString(item.returnDate) ?? asString(item.return_date);
    const price = asNumber(item.price);
    const parts = [label];
    if (returnDate) parts.push(`~ ${returnDate}`);
    if (price != null) parts.push(`${price}`);
    lines.push(parts.join(" "));
  }
  return lines;
}

function sellingPointItems(product: ProductContext): string[] {
  const points = product.sellingPoints;
  if (!points) return [];
  const items: string[] = [];
  for (const [key, label] of SELLING_POINT_LABELS) {
    const value = stripHtml(points[key]);
    if (value) items.push(`${label}: ${value}`);
  }
  return items;
}

function formatPrice(product: ProductContext): string | null {
  if (product.price == null) {
    return stripHtml(product.priceMeta);
  }
  return product.priceMeta ? `${product.price} (${product.priceMeta})` : String(product.price);
}

export function productMemoryImportance(isActive: boolean): number {
  return isActive ? PRODUCT_MEMORY_IMPORTANCE_ACTIVE : PRODUCT_MEMORY_IMPORTANCE_INACTIVE;
}

export function buildProductMemoryContent(product: ProductContext): string {
  const sellingPoints = sellingPointItems(product);
  const sellingTransport = product.sellingPoints?.transport?.trim() ?? null;
  const sellingInsurance = product.sellingPoints?.insurance?.trim() ?? null;
  const transportation =
    product.transportation && product.transportation !== sellingTransport ? product.transportation : null;
  const insurance = product.insurance && product.insurance !== sellingInsurance ? product.insurance : null;
  const campaignLabels = [
    ...product.campaigns.map((campaign) => taxonomyLabel(campaign)).filter((item): item is string => Boolean(item)),
    ...product.unresolvedCampaignLabels,
  ];

  const sections = [
    line("상품명", product.title),
    line("한줄소개", product.oneLiner),
    line("설명", product.description),
    line("목적지", taxonomyLabel(product.destination)),
    line("상품라인", taxonomyLabel(product.productLine)),
    line("가격", formatPrice(product)),
    line("기간", product.duration),
    bulletSection("판매포인트", sellingPoints),
    line("혜택", product.benefits),
    line("관광포인트", product.tourismPoints),
    line("가이드포인트", product.guidePoints),
    bulletSection("포함사항", [...splitBlocks(product.inclusions), ...splitBlocks(product.includedItems)]),
    bulletSection("불포함사항", splitBlocks(product.exclusions)),
    line("선택관광", product.optionalTours),
    line("선택경비", product.optionalExpenses),
    bulletSection("주요일정", flattenItinerary(product)),
    bulletSection("출발일정", flattenDepartures(product.departureSchedules)),
    line("숙박", product.accommodation),
    line("교통", transportation),
    line("보험", insurance),
    line("예약안내", product.bookingNotes),
    line("여행안내", product.travelNotes),
    line("환불규정", product.refundPolicy),
    bulletSection("태그", product.tags),
    bulletSection("캠페인", campaignLabels),
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n\n");
}

export function mapProductContextToMemoryDocument(product: ProductContext): MemoryDocument {
  return {
    memoryType: PRODUCT_MEMORY_TYPE,
    title: product.title,
    content: buildProductMemoryContent(product),
    sourceType: PRODUCT_MEMORY_SOURCE_TYPE,
    sourceId: product.id,
    importance: productMemoryImportance(product.isActive),
    confidence: PRODUCT_MEMORY_CONFIDENCE,
    expiresAt: null,
  };
}
