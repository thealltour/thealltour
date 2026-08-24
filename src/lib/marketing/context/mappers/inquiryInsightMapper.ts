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

const MAX_TOP_ITEMS = 5;
const MAX_QUESTION_LENGTH = 180;

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

  const questionCounts = new Map<string, number>();
  const concernCounts = new Map<string, number>();

  for (const inquiry of input.inquiries) {
    const question = truncate(inquiry.content);
    if (question) questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1);

    const status = (inquiry.bookingStatus ?? "").toLowerCase();
    if (status === "none" || status === "") conversionSummary.none += 1;
    else if (status === "reserved") conversionSummary.reserved += 1;
    else if (status === "completed") conversionSummary.completed += 1;
    else if (status === "canceled") conversionSummary.canceled += 1;
    else conversionSummary.other += 1;

    if (status === "canceled") {
      const concern = question || "canceled_inquiry";
      concernCounts.set(concern, (concernCounts.get(concern) ?? 0) + 1);
    }
  }

  return {
    topic: input.topic,
    productId: input.productId,
    period: input.period,
    inquiryCount: input.inquiries.length,
    topQuestions: topKeys(questionCounts, MAX_TOP_ITEMS),
    topConcerns: topKeys(concernCounts, MAX_TOP_ITEMS),
    conversionSummary,
    reviewSummary: input.reviewSummary ?? null,
  };
}

function truncate(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > MAX_QUESTION_LENGTH
    ? `${normalized.slice(0, MAX_QUESTION_LENGTH)}…`
    : normalized;
}

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}
