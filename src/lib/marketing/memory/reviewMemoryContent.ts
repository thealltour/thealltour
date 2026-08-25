import type { ReviewInsightContext } from "@/lib/marketing/context/types";
import {
  REVIEW_MEMORY_CONFIDENCE_HIGH,
  REVIEW_MEMORY_CONFIDENCE_LOW,
  REVIEW_MEMORY_CONFIDENCE_MID,
  REVIEW_MEMORY_IMPORTANCE,
  REVIEW_MEMORY_IMPORTANCE_ENOUGH,
  REVIEW_MEMORY_IMPORTANCE_RICH,
  REVIEW_MEMORY_MAX_SNIPPET_CHARS,
  REVIEW_MEMORY_MAX_SNIPPETS,
  REVIEW_MEMORY_MAX_SUMMARY_CHARS,
  REVIEW_MEMORY_MAX_TIPS,
  REVIEW_MEMORY_SOURCE_TYPE,
  REVIEW_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { normalizeMemoryText } from "@/lib/marketing/memory/normalization";
import type { MemoryDocument } from "@/lib/marketing/memory/types";

export type ReviewMemoryMappingInput = {
  productId: string;
  productTitle?: string | null;
  insight: ReviewInsightContext;
};

function clip(value: string, maxChars: number): string {
  const text = normalizeMemoryText(value);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd();
}

function clipItems(items: string[], maxItems: number, maxChars: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const text = clip(item, maxChars);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function line(label: string, value: string | null | undefined): string | null {
  const text = value ? clip(value, REVIEW_MEMORY_MAX_SUMMARY_CHARS) : "";
  return text ? `${label}: ${text}` : null;
}

function bulletSection(label: string, items: string[], maxItems = REVIEW_MEMORY_MAX_SNIPPETS): string | null {
  const cleaned = clipItems(items, maxItems, REVIEW_MEMORY_MAX_SNIPPET_CHARS);
  if (cleaned.length === 0) return null;
  return `${label}:\n${cleaned.map((item) => `- ${item}`).join("\n")}`;
}

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function subratingSection(insight: ReviewInsightContext): string | null {
  const rows = [
    insight.scheduleRating != null ? `- 일정: ${formatScore(insight.scheduleRating)}` : null,
    insight.stayRating != null ? `- 숙박: ${formatScore(insight.stayRating)}` : null,
    insight.guideRating != null ? `- 가이드: ${formatScore(insight.guideRating)}` : null,
    insight.foodRating != null ? `- 식사: ${formatScore(insight.foodRating)}` : null,
  ].filter((row): row is string => Boolean(row));
  if (rows.length === 0) return null;
  return `세부 평가:\n${rows.join("\n")}`;
}

export function reviewMemoryConfidence(reviewCount: number): number {
  if (reviewCount <= 2) return REVIEW_MEMORY_CONFIDENCE_LOW;
  if (reviewCount < 10) return REVIEW_MEMORY_CONFIDENCE_MID;
  return REVIEW_MEMORY_CONFIDENCE_HIGH;
}

export function reviewMemoryImportance(reviewCount: number): number {
  if (reviewCount >= 10) return REVIEW_MEMORY_IMPORTANCE_RICH;
  if (reviewCount >= 5) return REVIEW_MEMORY_IMPORTANCE_ENOUGH;
  return REVIEW_MEMORY_IMPORTANCE;
}

export function hasReviewMemoryContent(insight: ReviewInsightContext): boolean {
  return (
    insight.reviewCount > 0 ||
    Boolean(insight.summaryText) ||
    insight.positivePoints.length > 0 ||
    insight.negativePoints.length > 0 ||
    insight.contentTips.length > 0 ||
    insight.recommendedFor.length > 0 ||
    insight.averageRating != null ||
    insight.scheduleRating != null ||
    insight.stayRating != null ||
    insight.guideRating != null ||
    insight.foodRating != null
  );
}

export function buildReviewMemoryContent(input: ReviewMemoryMappingInput): string {
  const { productTitle, insight } = input;
  const sections = [
    line("상품", productTitle),
    line("리뷰 요약", insight.summaryText),
    insight.averageRating != null ? `평균 평점: ${formatScore(insight.averageRating)}` : null,
    insight.reviewCount > 0 ? `리뷰 수: ${insight.reviewCount}` : null,
    bulletSection("긍정 포인트", insight.positivePoints),
    bulletSection("부정 포인트", insight.negativePoints),
    bulletSection("추천 대상", insight.recommendedFor),
    subratingSection(insight),
    bulletSection("고객 팁", insight.contentTips, REVIEW_MEMORY_MAX_TIPS),
  ].filter((section): section is string => Boolean(section));
  return sections.join("\n\n");
}

export function mapReviewInsightToMemoryDocument(input: ReviewMemoryMappingInput): MemoryDocument | null {
  if (!hasReviewMemoryContent(input.insight)) return null;
  const content = buildReviewMemoryContent(input);
  if (!content) return null;
  const title = input.productTitle?.trim()
    ? `${normalizeMemoryText(input.productTitle)} 리뷰 인사이트`
    : "리뷰 인사이트";
  return {
    memoryType: REVIEW_MEMORY_TYPE,
    title,
    content,
    sourceType: REVIEW_MEMORY_SOURCE_TYPE,
    sourceId: input.productId,
    importance: reviewMemoryImportance(input.insight.reviewCount),
    confidence: reviewMemoryConfidence(input.insight.reviewCount),
    expiresAt: null,
  };
}
