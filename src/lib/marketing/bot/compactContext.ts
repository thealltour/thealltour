import { channelGovernancePolicy } from "@/lib/marketing/governance/constants";
import type {
  ContentHistoryItem,
  CustomerInsightContext,
  MarketingContextPackage,
  MemoryContext,
  PerformanceSummary,
  ProductContext,
  ReviewInsightContext,
} from "@/lib/marketing/context/types";
import type { SemanticMemoryMatch } from "@/lib/marketing/semantic/types";
import {
  BOT_MAX_HISTORY_ITEMS,
  BOT_MAX_MEMORY_MATCHES,
  BOT_MAX_PREVIEW_CHARS,
  BOT_MAX_TEXT_CHARS,
} from "@/lib/marketing/bot/constants";
import { stripForbiddenBotData, truncateBotText } from "@/lib/marketing/bot/sanitize";
import type {
  CompactContentHistoryItem,
  CompactContextSource,
  CompactCustomerInsight,
  CompactMarketingContext,
  CompactMemoryMatch,
  CompactPerformanceInsight,
  CompactProductContext,
  CompactReviewInsight,
  MarketingBotChannelPolicy,
} from "@/lib/marketing/bot/types";

export function botChannelPolicy(channel: string): MarketingBotChannelPolicy {
  const policy = channelGovernancePolicy(channel);
  return {
    channel,
    dailyMax: policy.dailyMax,
    sameAgendaCooldownDays: policy.sameAgendaCooldownDays,
    autoPublishEnabled: policy.autoPublishEnabled,
    reviewRequiredOnSemanticUnavailable: policy.reviewRequiredOnSemanticUnavailable,
  };
}

export function compactProduct(product: ProductContext | null | undefined): CompactProductContext | null {
  if (!product) return null;
  return stripForbiddenBotData({
    id: product.id,
    title: product.title,
    oneLiner: truncateBotText(product.oneLiner, BOT_MAX_TEXT_CHARS),
    description: truncateBotText(product.description, BOT_MAX_TEXT_CHARS),
    status: product.status,
    price: product.price,
    priceMeta: truncateBotText(product.priceMeta, BOT_MAX_PREVIEW_CHARS),
    duration: truncateBotText(product.duration, BOT_MAX_PREVIEW_CHARS),
    destination: product.destination?.displayLabel ?? product.destination?.name ?? null,
    productLine: product.productLine?.displayLabel ?? product.productLine?.name ?? null,
    tags: product.tags.slice(0, 12),
    inclusions: truncateBotText(product.inclusions ?? product.includedItems, BOT_MAX_TEXT_CHARS),
    exclusions: truncateBotText(product.exclusions, BOT_MAX_TEXT_CHARS),
    benefits: truncateBotText(product.benefits, BOT_MAX_TEXT_CHARS),
  });
}

export function compactCustomerInsight(
  insight: CustomerInsightContext | null | undefined,
): CompactCustomerInsight | null {
  if (!insight) return null;
  return {
    topic: insight.topic,
    inquiryCount: insight.inquiryCount,
    topQuestions: insight.topQuestions.slice(0, 5),
    topConcerns: insight.topConcerns.slice(0, 5),
    conversionSummary: insight.conversionSummary,
  };
}

export function compactReviewInsight(
  insight: ReviewInsightContext | null | undefined,
): CompactReviewInsight | null {
  if (!insight) return null;
  return {
    reviewCount: insight.reviewCount,
    averageRating: insight.averageRating,
    summaryText: truncateBotText(insight.summaryText, BOT_MAX_TEXT_CHARS),
    positivePoints: insight.positivePoints.slice(0, 5),
    negativePoints: insight.negativePoints.slice(0, 5),
    contentTips: insight.contentTips.slice(0, 5),
    recommendedFor: insight.recommendedFor.slice(0, 5),
  };
}

export function compactPerformance(
  performance: PerformanceSummary | null | undefined,
): CompactPerformanceInsight | null {
  if (!performance) return null;
  return {
    publicationCount: performance.publicationCount,
    metrics: performance.metrics.slice(0, 8).map((metric) => ({
      metricType: metric.metricType,
      value: metric.value,
    })),
    topPerformingContent: performance.topPerformingContent.slice(0, 5),
    topAgendas: performance.topAgendas.slice(0, 5),
  };
}

export function compactContentHistory(
  items: ContentHistoryItem[] | null | undefined,
): CompactContentHistoryItem[] {
  if (!items) return [];
  return items.slice(0, BOT_MAX_HISTORY_ITEMS).map((item) => ({
    id: item.id,
    channel: item.channel,
    title: truncateBotText(item.title, BOT_MAX_PREVIEW_CHARS),
    summary: truncateBotText(item.summary ?? item.body, BOT_MAX_PREVIEW_CHARS),
    publishedAt: item.publishedAt,
  }));
}

export function compactSources(pkg: MarketingContextPackage): CompactContextSource[] {
  return pkg.sources.map((source) => ({
    sourceType: source.sourceType,
    sourceTable: source.sourceTable,
    retrievedAt: source.retrievedAt,
  }));
}

export function compactMarketingContext(pkg: MarketingContextPackage): CompactMarketingContext {
  return stripForbiddenBotData({
    product: compactProduct(pkg.context.product),
    customerInsights: compactCustomerInsight(pkg.context.customerInsights),
    reviewInsights: compactReviewInsight(pkg.context.reviewInsights ?? pkg.context.customerInsights?.reviewSummary),
    performance: compactPerformance(pkg.context.performance),
    recentContent: compactContentHistory(pkg.context.contentHistory),
    sources: compactSources(pkg),
  });
}

export function compactSemanticMatches(matches: SemanticMemoryMatch[]): CompactMemoryMatch[] {
  return matches.slice(0, BOT_MAX_MEMORY_MATCHES).map((match) => ({
    memoryId: match.memoryId,
    title: truncateBotText(match.memory.title, BOT_MAX_PREVIEW_CHARS),
    contentPreview: truncateBotText(match.memory.content, BOT_MAX_PREVIEW_CHARS) ?? "",
    memoryType: match.memory.memoryType,
    sourceType: match.memory.sourceType,
    sourceId: match.memory.sourceId,
    similarity: match.score,
    provenance: {
      sourceType: "memory" as const,
      sourceTable: "ai_memory" as const,
      sourceId: match.source.sourceId,
    },
  }));
}

export function compactMemoryRows(rows: MemoryContext[]): CompactMemoryMatch[] {
  return rows.slice(0, BOT_MAX_MEMORY_MATCHES).map((row) => ({
    memoryId: row.id,
    title: truncateBotText(row.title, BOT_MAX_PREVIEW_CHARS),
    contentPreview: truncateBotText(row.content, BOT_MAX_PREVIEW_CHARS) ?? "",
    memoryType: row.memoryType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    similarity: 0,
    provenance: {
      sourceType: "memory" as const,
      sourceTable: "ai_memory" as const,
      sourceId: row.id,
    },
  }));
}
