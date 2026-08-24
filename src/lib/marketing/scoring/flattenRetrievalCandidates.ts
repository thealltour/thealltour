import type { ContextSource } from "@/lib/marketing/context/types";
import type { ExecutedRetrieval } from "@/lib/marketing/retrieval/types";
import type { ContextCandidate } from "@/lib/marketing/scoring/types";

function sourcesFor(all: ContextSource[], sourceType: ContextSource["sourceType"]): ContextSource[] {
  const matched = all.filter((source) => source.sourceType === sourceType);
  return matched.length > 0 ? matched : all;
}

export function flattenRetrievalCandidates(retrieved: ExecutedRetrieval): ContextCandidate[] {
  const candidates: ContextCandidate[] = [];
  const sources = retrieved.sources;

  if (retrieved.product) {
    candidates.push({
      id: `product:${retrieved.product.id}`,
      kind: "product",
      sourceKey: "product",
      sourceType: "product",
      data: retrieved.product,
      sources: sourcesFor(sources, "product"),
    });
  }

  if (retrieved.customerInsights) {
    candidates.push({
      id: `customerInsights:${retrieved.customerInsights.productId ?? "all"}`,
      kind: "customerInsights",
      sourceKey: "customerInsights",
      sourceType: "inquiry_insight",
      data: retrieved.customerInsights,
      sources: sourcesFor(sources, "inquiry_insight"),
    });
  }

  if (retrieved.bookingInsights) {
    candidates.push({
      id: `bookingInsights:${retrieved.bookingInsights.productId ?? "all"}`,
      kind: "bookingInsights",
      sourceKey: "bookings",
      sourceType: "booking_insight",
      data: retrieved.bookingInsights,
      sources: sourcesFor(sources, "booking_insight"),
    });
  }

  if (retrieved.reviewInsights) {
    candidates.push({
      id: `reviewInsights:${retrieved.reviewInsights.reviewCount}`,
      kind: "reviewInsights",
      sourceKey: "reviews",
      sourceType: "review_insight",
      data: retrieved.reviewInsights,
      sources: sourcesFor(sources, "review_insight"),
    });
  }

  for (const item of retrieved.contentHistory ?? []) {
    candidates.push({
      id: `contentHistory:${item.id}`,
      kind: "contentHistory",
      sourceKey: "contentHistory",
      sourceType: "content_history",
      data: item,
      sources: sourcesFor(sources, "content_history"),
    });
  }

  for (const item of retrieved.publications ?? []) {
    candidates.push({
      id: `publications:${item.id}`,
      kind: "publications",
      sourceKey: "publications",
      sourceType: "publication",
      data: item,
      sources: sourcesFor(sources, "publication"),
    });
  }

  if (retrieved.performance) {
    candidates.push({
      id: `performance:${retrieved.performance.productId ?? retrieved.performance.channel ?? "all"}`,
      kind: "performance",
      sourceKey: "performance",
      sourceType: "performance",
      data: retrieved.performance,
      sources: sourcesFor(sources, "performance"),
    });
  }

  for (const item of retrieved.memory ?? []) {
    candidates.push({
      id: `memory:${item.id}`,
      kind: "memory",
      sourceKey: "memory",
      sourceType: "memory",
      data: item,
      sources: sourcesFor(sources, "memory"),
    });
  }

  for (const item of retrieved.agendaHistory ?? []) {
    candidates.push({
      id: `agendaHistory:${item.id}`,
      kind: "agendaHistory",
      sourceKey: "agendas",
      sourceType: "agenda",
      data: item,
      sources: sourcesFor(sources, "agenda"),
    });
  }

  return candidates;
}
