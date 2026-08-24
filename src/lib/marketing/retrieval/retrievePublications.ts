import { mapAiPublicationRow } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { fetchAiContentIdsByProduct } from "@/lib/marketing/context/sources/metricCountSource";
import { fetchPublicationHistoryRows } from "@/lib/marketing/context/sources/publicationSource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import { MAX_RETRIEVAL_LIMIT } from "@/lib/marketing/retrieval/constants";
import type { PublicationContext } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrievePublications(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<PublicationContext[]>> {
  const period = requireRetrievalPeriod(request);
  let contentIds: string[] | undefined;
  if (request.productId) {
    contentIds = await fetchAiContentIdsByProduct(request.productId, MAX_RETRIEVAL_LIMIT, {
      campaignId: request.campaignId,
      agendaId: request.agendaId,
    });
  }

  const rows = await fetchPublicationHistoryRows({
    channel: request.channel,
    contentId: request.contentId,
    contentIds,
    status: request.publicationStatus,
    periodStart: period.start,
    periodEnd: period.end,
    limit: request.limit,
  });

  return createRetrievalResult({
    data: rows.map(mapAiPublicationRow).filter((item): item is PublicationContext => item != null),
    sourceType: "publication",
    sourceTable: "ai_publications",
    sourceId: request.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
}
