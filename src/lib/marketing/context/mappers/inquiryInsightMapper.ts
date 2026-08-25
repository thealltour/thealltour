import { asRecord, asString } from "@/lib/marketing/context/json";
import type {
  ConversionSummary,
  CustomerInsightContext,
  InquiryInsightContext,
  ReviewInsightContext,
} from "@/lib/marketing/context/types";

export type InquiryInsightRow = {
  content?: unknown;
  product_id?: unknown;
  product_title?: unknown;
  acquisition_channel?: unknown;
  acquisition_source_label?: unknown;
  acquisition_medium?: unknown;
  first_touch?: unknown;
  consultation_status?: unknown;
  booking_status?: unknown;
  created_at?: unknown;
};

/** PII-safe projection: no name, phone, email, address, passport, member_id, IP, token. */
export const INQUIRY_INSIGHT_COLUMN_LIST = [
  "content",
  "product_id",
  "product_title",
  "acquisition_channel",
  "acquisition_source_label",
  "acquisition_medium",
  "first_touch",
  "consultation_status",
  "booking_status",
  "created_at",
] as const;

const MAX_TOP_ITEMS = 5;
const MAX_QUESTION_LENGTH = 180;

export type CountedLabel = {
  label: string;
  count: number;
};

export function normalizeInquiryQuestion(text: string, maxLength = MAX_QUESTION_LENGTH): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

export function countInquiryQuestions(
  inquiries: InquiryInsightContext[],
  options?: { limit?: number; maxLength?: number; normalize?: (text: string) => string },
): CountedLabel[] {
  const maxLength = options?.maxLength ?? MAX_QUESTION_LENGTH;
  const limit = options?.limit ?? MAX_TOP_ITEMS;
  const normalize = options?.normalize ?? ((text: string) => normalizeInquiryQuestion(text, maxLength));
  const counts = new Map<string, number>();
  for (const inquiry of inquiries) {
    const question = normalize(inquiry.content);
    if (!question) continue;
    counts.set(question, (counts.get(question) ?? 0) + 1);
  }
  return topCounted(counts, limit);
}

export function countInquiryLabels(
  inquiries: InquiryInsightContext[],
  pick: (inquiry: InquiryInsightContext) => string | null,
  limit = 8,
): CountedLabel[] {
  const counts = new Map<string, number>();
  for (const inquiry of inquiries) {
    const label = pick(inquiry)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return topCounted(counts, limit);
}

function topCounted(counts: Map<string, number>, limit: number): CountedLabel[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function mapInquiryRowToInsight(row: InquiryInsightRow): InquiryInsightContext {
  return {
    content: asString(row.content) ?? "",
    productId: asString(row.product_id),
    productTitle: asString(row.product_title),
    acquisitionChannel: asString(row.acquisition_channel),
    acquisitionSourceLabel: asString(row.acquisition_source_label),
    acquisitionMedium: asString(row.acquisition_medium),
    firstTouch: asRecord(row.first_touch),
    consultationStatus: asString(row.consultation_status),
    bookingStatus: asString(row.booking_status),
    createdAt: asString(row.created_at),
  };
}

export function aggregateCustomerInsights(input: {
  topic: string;
  productId: string | null;
  period: { start: string; end: string };
  inquiries: InquiryInsightContext[];
  reviewSummary?: ReviewInsightContext | null;
}): CustomerInsightContext {
  const conversionSummary: ConversionSummary = {
    none: 0,
    reserved: 0,
    completed: 0,
    canceled: 0,
    other: 0,
  };

  const concernCounts = new Map<string, number>();

  for (const inquiry of input.inquiries) {
    const status = (inquiry.bookingStatus ?? "").toLowerCase();
    if (status === "none" || status === "") conversionSummary.none += 1;
    else if (status === "reserved") conversionSummary.reserved += 1;
    else if (status === "completed") conversionSummary.completed += 1;
    else if (status === "canceled") conversionSummary.canceled += 1;
    else conversionSummary.other += 1;

    if (status === "canceled") {
      const concern = normalizeInquiryQuestion(inquiry.content) || "canceled_inquiry";
      concernCounts.set(concern, (concernCounts.get(concern) ?? 0) + 1);
    }
  }

  return {
    topic: input.topic,
    productId: input.productId,
    period: input.period,
    inquiryCount: input.inquiries.length,
    topQuestions: countInquiryQuestions(input.inquiries).map((item) => item.label),
    topConcerns: topCounted(concernCounts, MAX_TOP_ITEMS).map((item) => item.label),
    conversionSummary,
    reviewSummary: input.reviewSummary ?? null,
  };
}
