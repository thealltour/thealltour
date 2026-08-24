import { assembleMarketingContextPackage } from "@/lib/marketing/context/assembleMarketingContextPackage";
import type { MarketingContextPackage, MarketingContextRequest } from "@/lib/marketing/context/types";
import type {
  ExecutedRetrieval,
  ParsedMarketingRetrievalRequest,
  RetrievalAdapters,
  RetrievalPlan,
  RetrievalResult,
} from "@/lib/marketing/retrieval/types";
import { assertPlanPeriod } from "@/lib/marketing/retrieval/validation";

async function settle<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function executeRetrievalPlan(
  request: ParsedMarketingRetrievalRequest,
  plan: RetrievalPlan,
  adapters: RetrievalAdapters,
): Promise<ExecutedRetrieval> {
  assertPlanPeriod(request, plan);
  const retrievedAt = new Date().toISOString();
  const planned = new Set(plan.sources);

  const [
    product,
    customerInsights,
    bookings,
    reviews,
    contentHistory,
    publications,
    performance,
    memory,
    agendas,
  ] = await Promise.all([
    planned.has("product") ? settle(() => adapters.retrieveProduct(request)) : Promise.resolve(null),
    planned.has("customerInsights")
      ? settle(() => adapters.retrieveCustomerInsights(request))
      : Promise.resolve(null),
    planned.has("bookings") ? settle(() => adapters.retrieveBookings(request)) : Promise.resolve(null),
    planned.has("reviews") ? settle(() => adapters.retrieveReviews(request)) : Promise.resolve(null),
    planned.has("contentHistory")
      ? settle(() => adapters.retrieveContentHistory(request))
      : Promise.resolve(null),
    planned.has("publications")
      ? settle(() => adapters.retrievePublications(request))
      : Promise.resolve(null),
    planned.has("performance")
      ? settle(() => adapters.retrievePerformance(request))
      : Promise.resolve(null),
    planned.has("memory") ? settle(() => adapters.retrieveMemory(request)) : Promise.resolve(null),
    planned.has("agendas") ? settle(() => adapters.retrieveAgendas(request)) : Promise.resolve(null),
  ]);

  return {
    product: product?.data ?? null,
    customerInsights: customerInsights?.data ?? null,
    bookingInsights: bookings?.data ?? null,
    reviewInsights: reviews?.data ?? null,
    contentHistory: contentHistory?.data ?? null,
    publications: publications?.data ?? null,
    performance: performance?.data ?? null,
    memory: memory?.data ?? null,
    agendaHistory: agendas?.data ?? null,
    sources: collectSources([
      product,
      customerInsights,
      bookings,
      reviews,
      contentHistory,
      publications,
      performance,
      memory,
      agendas,
    ]),
    retrievedAt,
  };
}

function collectSources(results: Array<RetrievalResult<unknown> | null>): ExecutedRetrieval["sources"] {
  return results.flatMap((result) => result?.sources ?? []);
}

export function assembleFromRetrieval(
  request: MarketingContextRequest,
  retrieval: ExecutedRetrieval,
  extras?: {
    ranking?: MarketingContextPackage["ranking"];
    semantic?: MarketingContextPackage["semantic"];
  },
): MarketingContextPackage {
  return assembleMarketingContextPackage({
    request,
    product: retrieval.product,
    customerInsights: retrieval.customerInsights,
    bookingInsights: retrieval.bookingInsights,
    reviewInsights: retrieval.reviewInsights,
    contentHistory: retrieval.contentHistory,
    publications: retrieval.publications,
    performance: retrieval.performance,
    memory: retrieval.memory,
    agendaHistory: retrieval.agendaHistory,
    sources: retrieval.sources,
    generatedAt: retrieval.retrievedAt,
    ranking: extras?.ranking,
    semantic: extras?.semantic,
  });
}
