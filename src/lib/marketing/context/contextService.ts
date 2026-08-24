import "server-only";

import { loadProductContext, loadTaxonomyContext } from "@/lib/marketing/context/loadProductContext";
import { defaultRetrievalAdapters } from "@/lib/marketing/retrieval/adapters";
import { runMarketingRetrieval } from "@/lib/marketing/retrieval/runMarketingRetrieval";
import { aggregateCustomerInsights, mapInquiryRowToInsight } from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import { aggregateBookingInsights } from "@/lib/marketing/context/mappers/bookingInsightMapper";
import { emptyReviewInsight, mapReviewInsight } from "@/lib/marketing/context/mappers/reviewInsightMapper";
import {
  mapAiContentToHistory,
  mapThreadMarketingPostToHistory,
} from "@/lib/marketing/context/mappers/contentHistoryMapper";
import { mapAiPublicationRow } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { mapPerformanceSummary } from "@/lib/marketing/context/mappers/performanceMapper";
import { mapAiMemoryRow } from "@/lib/marketing/context/mappers/memoryContextMapper";
import { fetchInquiryInsightRows } from "@/lib/marketing/context/sources/inquirySource";
import { fetchBookingInsightRows } from "@/lib/marketing/context/sources/bookingSource";
import { fetchProductReviewSummaryRow, fetchReviewRowsForProduct } from "@/lib/marketing/context/sources/reviewSource";
import { fetchAiFeedbackRows } from "@/lib/marketing/context/sources/analyticsSource";
import { fetchThreadMarketingPostRows, fetchAiContentRows } from "@/lib/marketing/context/sources/legacyContentSource";
import { fetchPublicationHistoryRows } from "@/lib/marketing/context/sources/publicationSource";
import { fetchAiMemoryRows } from "@/lib/marketing/context/sources/memorySource";
import type {
  BookingInsightContext,
  ContentHistoryItem,
  CustomerInsightContext,
  MarketingContextPackage,
  MarketingContextRequest,
  MemoryContext,
  PerformanceSummary,
  ProductContext,
  PublicationContext,
  ReviewInsightContext,
  TaxonomyContext,
} from "@/lib/marketing/context/types";
import { requireUuid, resolvePeriod } from "@/lib/marketing/context/validation";

export async function getProductContext(productId: string): Promise<ProductContext | null> {
  const id = requireUuid(productId, "productId");
  return loadProductContext(id);
}

export async function getTaxonomyContext(taxonomyId: string): Promise<TaxonomyContext | null> {
  const id = requireUuid(taxonomyId, "taxonomyId");
  return loadTaxonomyContext(id);
}

export async function getCustomerInsights(params: {
  productId?: string;
  campaignId?: string;
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<CustomerInsightContext> {
  if (params.productId) requireUuid(params.productId, "productId");
  if (params.campaignId) requireUuid(params.campaignId, "campaignId");
  const period = resolvePeriod(params);
  const rows = await fetchInquiryInsightRows({
    productId: params.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
  return aggregateCustomerInsights({
    topic: "voice_of_customer",
    productId: params.productId ?? null,
    period,
    inquiries: rows.map(mapInquiryRowToInsight),
  });
}

export async function getBookingInsights(params: {
  productId?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<BookingInsightContext> {
  if (params.productId) requireUuid(params.productId, "productId");
  const period = resolvePeriod(params);
  const rows = await fetchBookingInsightRows({
    productId: params.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
  return aggregateBookingInsights({
    productId: params.productId ?? null,
    period,
    rows,
  });
}

export async function getReviewInsights(params: {
  productId?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<ReviewInsightContext> {
  if (!params.productId) return emptyReviewInsight();
  const productId = requireUuid(params.productId, "productId");
  const period = resolvePeriod(params);
  const [summary, reviews] = await Promise.all([
    fetchProductReviewSummaryRow(productId),
    fetchReviewRowsForProduct({ productId, periodStart: period.start, periodEnd: period.end }),
  ]);
  return mapReviewInsight({ summary, reviews });
}

export async function getContentHistory(params: {
  productId?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<ContentHistoryItem[]> {
  if (params.productId) requireUuid(params.productId, "productId");
  const period = resolvePeriod(params);
  const [threadPosts, aiContents] = await Promise.all([
    fetchThreadMarketingPostRows({
      productId: params.productId,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchAiContentRows({
      productId: params.productId,
      periodStart: period.start,
      periodEnd: period.end,
    }),
  ]);
  return [
    ...threadPosts.map(mapThreadMarketingPostToHistory),
    ...aiContents.map(mapAiContentToHistory),
  ].filter((item): item is ContentHistoryItem => item != null);
}

export async function getPublicationHistory(params: {
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<PublicationContext[]> {
  const period = resolvePeriod(params);
  const rows = await fetchPublicationHistoryRows({
    channel: params.channel,
    periodStart: period.start,
    periodEnd: period.end,
  });
  return rows.map(mapAiPublicationRow).filter((item): item is PublicationContext => item != null);
}

export async function getPerformanceSummary(params: {
  productId?: string;
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<PerformanceSummary> {
  if (params.productId) requireUuid(params.productId, "productId");
  const period = resolvePeriod(params);
  const [publications, feedback] = await Promise.all([
    fetchPublicationHistoryRows({
      channel: params.channel,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchAiFeedbackRows({
      channel: params.channel,
      periodStart: period.start,
      periodEnd: period.end,
    }),
  ]);
  return mapPerformanceSummary({
    period,
    channel: params.channel ?? null,
    productId: params.productId ?? null,
    publicationCount: publications.length,
    rows: feedback,
  });
}

export async function getMemoryContext(params: {
  memoryType?: string;
  sourceType?: string;
  sourceId?: string;
}): Promise<MemoryContext[]> {
  const rows = await fetchAiMemoryRows(params);
  return rows.map(mapAiMemoryRow).filter((item): item is MemoryContext => item != null);
}

export async function composeMarketingContext(
  request: MarketingContextRequest,
): Promise<MarketingContextPackage> {
  return runMarketingRetrieval(request, defaultRetrievalAdapters);
}
