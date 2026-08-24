import { aggregateCustomerInsights, mapInquiryRowToInsight } from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import { fetchInquiryCount } from "@/lib/marketing/context/sources/metricCountSource";
import { fetchInquiryInsightRows } from "@/lib/marketing/context/sources/inquirySource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { CustomerInsightContext } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrieveCustomerInsights(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<CustomerInsightContext>> {
  const period = requireRetrievalPeriod(request);
  const acquisitionChannel = request.acquisitionChannel ?? request.channel;
  const [rows, inquiryCount] = await Promise.all([
    fetchInquiryInsightRows({
      productId: request.productId,
      periodStart: period.start,
      periodEnd: period.end,
      acquisitionChannel,
      limit: request.limit,
    }),
    fetchInquiryCount({
      productId: request.productId,
      periodStart: period.start,
      periodEnd: period.end,
      acquisitionChannel,
    }),
  ]);

  const insights = aggregateCustomerInsights({
    topic: "voice_of_customer",
    productId: request.productId ?? null,
    period,
    inquiries: rows.map(mapInquiryRowToInsight),
  });

  return createRetrievalResult({
    data: { ...insights, inquiryCount },
    sourceType: "inquiry_insight",
    sourceTable: "inquiries",
    sourceId: request.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
}
