import { mapPerformanceSummary } from "@/lib/marketing/context/mappers/performanceMapper";
import { fetchAiFeedbackRows } from "@/lib/marketing/context/sources/analyticsSource";
import {
  fetchAnalyticsEventCount,
  fetchAiContentIdsByProduct,
  fetchBookingCount,
  fetchInquiryCount,
  fetchKakaoMomentCreativeMetrics,
  fetchPublicationCount,
  fetchThreadMarketingPostCount,
} from "@/lib/marketing/context/sources/metricCountSource";
import { fetchPublicationHistoryRows } from "@/lib/marketing/context/sources/publicationSource";
import { KAKAO_CHANNELS, MAX_RETRIEVAL_LIMIT } from "@/lib/marketing/retrieval/constants";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { MetricSummary, PerformanceSummary } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

function includeKakao(request: ParsedMarketingRetrievalRequest): boolean {
  if (request.productId) return false;
  if (!request.channel) return true;
  return KAKAO_CHANNELS.has(request.channel);
}

export async function retrievePerformance(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<PerformanceSummary>> {
  const period = requireRetrievalPeriod(request);
  const contentIds = request.productId
    ? await fetchAiContentIdsByProduct(request.productId, MAX_RETRIEVAL_LIMIT, {
        campaignId: request.campaignId,
        agendaId: request.agendaId,
      })
    : undefined;

  const publications = await fetchPublicationHistoryRows({
    channel: request.channel,
    contentIds,
    periodStart: period.start,
    periodEnd: period.end,
    limit: request.limit,
  });
  const publicationIds = publications
    .map((row) => (typeof row.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));

  const [feedback, publicationCount, inquiryCount, bookingCount, threadCount, analyticsCount, kakaoRows] =
    await Promise.all([
      fetchAiFeedbackRows({
        channel: request.channel,
        publicationIds: request.productId ? publicationIds : undefined,
        periodStart: period.start,
        periodEnd: period.end,
        limit: request.limit,
      }),
      fetchPublicationCount({
        channel: request.channel,
        contentIds,
        periodStart: period.start,
        periodEnd: period.end,
      }),
      fetchInquiryCount({
        productId: request.productId,
        periodStart: period.start,
        periodEnd: period.end,
        acquisitionChannel: request.acquisitionChannel ?? request.channel,
      }),
      fetchBookingCount({
        productId: request.productId,
        periodStart: period.start,
        periodEnd: period.end,
        bookingStatus: request.bookingStatus,
      }),
      fetchThreadMarketingPostCount({
        productId: request.productId,
        periodStart: period.start,
        periodEnd: period.end,
      }),
      fetchAnalyticsEventCount({
        productId: request.productId,
        periodStart: period.start,
        periodEnd: period.end,
      }),
      includeKakao(request)
        ? fetchKakaoMomentCreativeMetrics({
            periodStart: period.start,
            periodEnd: period.end,
            limit: request.limit,
          })
        : Promise.resolve([]),
    ]);

  const additionalMetrics: MetricSummary[] = [
    { metricType: "inquiry_count", value: inquiryCount, change: null, measuredAt: period.end },
    { metricType: "booking_count", value: bookingCount, change: null, measuredAt: period.end },
    { metricType: "thread_marketing_post_count", value: threadCount, change: null, measuredAt: period.end },
    { metricType: "analytics_event_count", value: analyticsCount, change: null, measuredAt: period.end },
  ];

  if (kakaoRows.length > 0) {
    additionalMetrics.push(
      {
        metricType: "kakao_cost",
        value: kakaoRows.reduce((sum, row) => sum + row.cost, 0),
        change: null,
        measuredAt: period.end,
      },
      {
        metricType: "kakao_impressions",
        value: kakaoRows.reduce((sum, row) => sum + row.impressions, 0),
        change: null,
        measuredAt: period.end,
      },
      {
        metricType: "kakao_clicks",
        value: kakaoRows.reduce((sum, row) => sum + row.clicks, 0),
        change: null,
        measuredAt: period.end,
      },
    );
  }

  return createRetrievalResult({
    data: mapPerformanceSummary({
      period,
      channel: request.channel ?? null,
      productId: request.productId ?? null,
      publicationCount,
      rows: feedback,
      additionalMetrics,
    }),
    sourceType: "performance",
    sourceTable: "ai_feedback",
    sourceId: request.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
}
