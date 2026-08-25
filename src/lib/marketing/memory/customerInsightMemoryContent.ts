import type {
  ConversionSummary,
  CustomerInsightContext,
  InquiryInsightContext,
} from "@/lib/marketing/context/types";
import {
  countInquiryLabels,
  countInquiryQuestions,
  normalizeInquiryQuestion,
} from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import {
  CUSTOMER_INSIGHT_CONFIDENCE_HIGH,
  CUSTOMER_INSIGHT_CONFIDENCE_LOW,
  CUSTOMER_INSIGHT_CONFIDENCE_MID,
  CUSTOMER_INSIGHT_EXPIRES_DAYS,
  CUSTOMER_INSIGHT_IMPORTANCE_HIGH,
  CUSTOMER_INSIGHT_IMPORTANCE_LOW,
  CUSTOMER_INSIGHT_IMPORTANCE_MID,
  CUSTOMER_INSIGHT_MAX_QUESTION_CHARS,
  CUSTOMER_INSIGHT_MAX_QUESTIONS,
  CUSTOMER_INSIGHT_SOURCE_TYPE,
  CUSTOMER_INSIGHT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { normalizeMemoryText } from "@/lib/marketing/memory/normalization";
import type { MemoryDocument } from "@/lib/marketing/memory/types";

export type CustomerInsightWindow = {
  key: string;
  lookbackDays: number;
  explicitRange: boolean;
  period: { start: string; end: string };
};

export type CustomerInsightMappingInput = {
  productId: string;
  productTitle?: string | null;
  window: CustomerInsightWindow;
  inquiries: InquiryInsightContext[];
  insight: CustomerInsightContext;
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
const PHONE_RE = /0\d{1,2}-?\d{3,4}-?\d{4}/g;

export function customerInsightSourceId(productId: string, windowKey: string): string {
  return `${productId}:${windowKey}`;
}

export function customerInsightWindowKey(input: {
  lookbackDays: number;
  explicitRange: boolean;
  periodStart: string;
  periodEnd: string;
}): string {
  if (input.explicitRange) {
    return `${input.periodStart.slice(0, 10)}_${input.periodEnd.slice(0, 10)}`;
  }
  return `${input.lookbackDays}d`;
}

export function customerInsightExpiresAt(now: Date, days = CUSTOMER_INSIGHT_EXPIRES_DAYS): string {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

export function customerInsightConfidence(inquiryCount: number): number {
  if (inquiryCount <= 2) return CUSTOMER_INSIGHT_CONFIDENCE_LOW;
  if (inquiryCount < 10) return CUSTOMER_INSIGHT_CONFIDENCE_MID;
  return CUSTOMER_INSIGHT_CONFIDENCE_HIGH;
}

export function customerInsightImportance(inquiryCount: number): number {
  if (inquiryCount <= 2) return CUSTOMER_INSIGHT_IMPORTANCE_LOW;
  if (inquiryCount < 10) return CUSTOMER_INSIGHT_IMPORTANCE_MID;
  return CUSTOMER_INSIGHT_IMPORTANCE_HIGH;
}

export function redactObviousPii(text: string): string {
  return text.replace(EMAIL_RE, "").replace(PHONE_RE, "").replace(/\s+/g, " ").trim();
}

export function acquisitionLabel(inquiry: InquiryInsightContext): string | null {
  return inquiry.acquisitionSourceLabel ?? inquiry.acquisitionChannel ?? inquiry.acquisitionMedium;
}

function countedSection(title: string, items: Array<{ label: string; count: number }>): string | null {
  if (items.length === 0) return null;
  return `${title}:\n${items.map((item) => `- ${item.label} (${item.count})`).join("\n")}`;
}

function conversionSection(summary: ConversionSummary): string | null {
  const rows = (["none", "reserved", "completed", "canceled", "other"] as const)
    .filter((key) => summary[key] > 0)
    .map((key) => `- ${key} (${summary[key]})`);
  if (rows.length === 0) return null;
  return `예약 전환:\n${rows.join("\n")}`;
}

function periodLabel(window: CustomerInsightWindow): string {
  if (window.explicitRange) {
    return `${window.period.start.slice(0, 10)} ~ ${window.period.end.slice(0, 10)}`;
  }
  return `최근 ${window.lookbackDays}일`;
}

export function buildCustomerInsightMemoryContent(input: CustomerInsightMappingInput): string {
  const questions = countInquiryQuestions(input.inquiries, {
    limit: CUSTOMER_INSIGHT_MAX_QUESTIONS,
    maxLength: CUSTOMER_INSIGHT_MAX_QUESTION_CHARS,
    normalize: (text) =>
      normalizeInquiryQuestion(redactObviousPii(text), CUSTOMER_INSIGHT_MAX_QUESTION_CHARS),
  });
  const acquisition = countInquiryLabels(input.inquiries, acquisitionLabel);
  const consultation = countInquiryLabels(input.inquiries, (inquiry) => inquiry.consultationStatus);
  const concerns = countInquiryQuestions(
    input.inquiries.filter((inquiry) => (inquiry.bookingStatus ?? "").toLowerCase() === "canceled"),
    {
      limit: CUSTOMER_INSIGHT_MAX_QUESTIONS,
      maxLength: CUSTOMER_INSIGHT_MAX_QUESTION_CHARS,
      normalize: (text) =>
        normalizeInquiryQuestion(redactObviousPii(text), CUSTOMER_INSIGHT_MAX_QUESTION_CHARS),
    },
  );

  const sections = [
    input.productTitle ? `상품: ${normalizeMemoryText(input.productTitle)}` : null,
    `기간: ${periodLabel(input.window)}`,
    `문의 수: ${input.insight.inquiryCount}`,
    countedSection("주요 고객 질문", questions),
    countedSection("주요 고민", concerns),
    countedSection("유입", acquisition),
    countedSection("상담 상태", consultation),
    conversionSection(input.insight.conversionSummary),
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n\n");
}

export function mapCustomerInsightToMemoryDocument(
  input: CustomerInsightMappingInput,
  now: Date = new Date(),
): MemoryDocument | null {
  if (input.insight.inquiryCount <= 0) return null;
  const content = buildCustomerInsightMemoryContent(input);
  if (!content) return null;
  const title = input.productTitle?.trim()
    ? `${normalizeMemoryText(input.productTitle)} 고객 문의 인사이트`
    : "고객 문의 인사이트";
  return {
    memoryType: CUSTOMER_INSIGHT_MEMORY_TYPE,
    title,
    content,
    sourceType: CUSTOMER_INSIGHT_SOURCE_TYPE,
    sourceId: customerInsightSourceId(input.productId, input.window.key),
    importance: customerInsightImportance(input.insight.inquiryCount),
    confidence: customerInsightConfidence(input.insight.inquiryCount),
    expiresAt: customerInsightExpiresAt(now),
    metadata: {
      productId: input.productId,
      inquiryCount: input.insight.inquiryCount,
      periodStart: input.window.period.start,
      periodEnd: input.window.period.end,
      windowKey: input.window.key,
    },
  };
}
