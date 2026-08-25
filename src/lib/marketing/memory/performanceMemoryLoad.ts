import "server-only";

import { asString } from "@/lib/marketing/context/json";
import { loadProductContexts } from "@/lib/marketing/context/loadProductContext";
import {
  fetchAiContentLinksByProductIds,
  fetchProductIdOccurrences,
} from "@/lib/marketing/context/sources/metricCountSource";
import { fetchAiFeedbackRows } from "@/lib/marketing/context/sources/analyticsSource";
import { fetchPublicationHistoryRows } from "@/lib/marketing/context/sources/publicationSource";
import {
  PERFORMANCE_MEMORY_MAX_CONTENTS,
  PERFORMANCE_MEMORY_MAX_FEEDBACK,
  PERFORMANCE_MEMORY_MAX_PUBLICATIONS,
} from "@/lib/marketing/memory/constants";
import { usesThreadPublicationFallback } from "@/lib/marketing/memory/performanceMemoryContent";
import type {
  ParsedPerformanceMemoryLoadParams,
  PerformanceMemoryBundle,
} from "@/lib/marketing/memory/sources/performanceMemorySource";

function countFor(counts: Map<string, number>, productId: string): number {
  return counts.get(productId) ?? 0;
}

export async function loadPerformanceMemoryBundles(
  params: ParsedPerformanceMemoryLoadParams,
): Promise<PerformanceMemoryBundle[]> {
  const ids = params.ids.slice(0, params.limit);
  if (ids.length === 0) return [];
  const channel = params.channel ?? undefined;

  const [links, products, inquiryCounts, bookingCounts, threadCounts, analyticsCounts] = await Promise.all([
    fetchAiContentLinksByProductIds(ids, PERFORMANCE_MEMORY_MAX_CONTENTS),
    loadProductContexts({ ids, limit: ids.length }),
    fetchProductIdOccurrences({
      table: "inquiries",
      dateColumn: "created_at",
      productIds: ids,
      periodStart: params.period.start,
      periodEnd: params.period.end,
    }),
    fetchProductIdOccurrences({
      table: "travel_bookings",
      dateColumn: "created_at",
      productIds: ids,
      periodStart: params.period.start,
      periodEnd: params.period.end,
    }),
    usesThreadPublicationFallback(params.channel, 0)
      ? fetchProductIdOccurrences({
          table: "thread_marketing_posts",
          dateColumn: "published_at",
          productIds: ids,
          periodStart: params.period.start,
          periodEnd: params.period.end,
        })
      : Promise.resolve(new Map<string, number>()),
    fetchProductIdOccurrences({
      table: "analytics_events",
      dateColumn: "occurred_at",
      productIds: ids,
      periodStart: params.period.start,
      periodEnd: params.period.end,
    }),
  ]);

  const contentIds = links.map((link) => link.id);
  const publications = await fetchPublicationHistoryRows({
    channel,
    contentIds,
    periodStart: params.period.start,
    periodEnd: params.period.end,
    limit: PERFORMANCE_MEMORY_MAX_PUBLICATIONS,
  });
  const publicationIds = publications
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));
  const feedback = await fetchAiFeedbackRows({
    channel,
    publicationIds,
    periodStart: params.period.start,
    periodEnd: params.period.end,
    limit: PERFORMANCE_MEMORY_MAX_FEEDBACK,
  });

  const productByContentId = new Map(links.map((link) => [link.id, link.productId]));
  const contentTitles: Record<string, string> = {};
  for (const link of links) {
    if (link.title) contentTitles[link.id] = link.title;
  }
  const titleByProduct = new Map(products.map((product) => [product.id, product.title]));

  const publicationsByProduct = new Map<string, typeof publications>();
  const publicationContentIdsByProduct = new Map<string, Record<string, string>>();
  for (const publication of publications) {
    const contentId = asString(publication.content_id);
    const publicationId = asString(publication.id);
    const productId = contentId ? productByContentId.get(contentId) : undefined;
    if (!productId || !publicationId || !contentId) continue;
    const list = publicationsByProduct.get(productId) ?? [];
    list.push(publication);
    publicationsByProduct.set(productId, list);
    const map = publicationContentIdsByProduct.get(productId) ?? {};
    map[publicationId] = contentId;
    publicationContentIdsByProduct.set(productId, map);
  }

  const feedbackByProduct = new Map<string, typeof feedback>();
  const productByPublicationId = new Map<string, string>();
  for (const [productId, pubs] of publicationsByProduct) {
    for (const publication of pubs) {
      const publicationId = asString(publication.id);
      if (publicationId) productByPublicationId.set(publicationId, productId);
    }
  }
  for (const row of feedback) {
    const publicationId = asString(row.publication_id);
    const productId = publicationId ? productByPublicationId.get(publicationId) : undefined;
    if (!productId) continue;
    const list = feedbackByProduct.get(productId) ?? [];
    list.push(row);
    feedbackByProduct.set(productId, list);
  }

  return ids.map((productId) => ({
    productId,
    productTitle: titleByProduct.get(productId) ?? null,
    channel: params.channel,
    publicationCount: (publicationsByProduct.get(productId) ?? []).length,
    threadPostCount: countFor(threadCounts, productId),
    inquiryCount: countFor(inquiryCounts, productId),
    bookingCount: countFor(bookingCounts, productId),
    analyticsEventCount: countFor(analyticsCounts, productId),
    feedback: feedbackByProduct.get(productId) ?? [],
    publicationContentIds: publicationContentIdsByProduct.get(productId) ?? {},
    contentTitles,
  }));
}
