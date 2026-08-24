import { aggregateBookingInsights } from "@/lib/marketing/context/mappers/bookingInsightMapper";
import { fetchBookingCount } from "@/lib/marketing/context/sources/metricCountSource";
import { fetchBookingInsightRows } from "@/lib/marketing/context/sources/bookingSource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { BookingInsightContext } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrieveBookings(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<BookingInsightContext>> {
  const period = requireRetrievalPeriod(request);
  const [rows, bookingCount] = await Promise.all([
    fetchBookingInsightRows({
      productId: request.productId,
      periodStart: period.start,
      periodEnd: period.end,
      bookingStatus: request.bookingStatus,
      limit: request.limit,
    }),
    fetchBookingCount({
      productId: request.productId,
      periodStart: period.start,
      periodEnd: period.end,
      bookingStatus: request.bookingStatus,
    }),
  ]);

  const insights = aggregateBookingInsights({
    productId: request.productId ?? null,
    period,
    rows,
  });

  return createRetrievalResult({
    data: { ...insights, bookingCount },
    sourceType: "booking_insight",
    sourceTable: "travel_bookings",
    sourceId: request.productId,
    periodStart: period.start,
    periodEnd: period.end,
  });
}
