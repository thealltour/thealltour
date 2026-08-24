import { asInteger, asString } from "@/lib/marketing/context/json";
import type { BookingInsightContext } from "@/lib/marketing/context/types";

export type TravelBookingInsightRow = {
  booking_status?: unknown;
  traveler_count?: unknown;
  payment_total_amount?: unknown;
  product_id?: unknown;
  departure_date?: unknown;
};

export function aggregateBookingInsights(input: {
  productId: string | null;
  period: { start: string; end: string };
  rows: TravelBookingInsightRow[];
}): BookingInsightContext {
  let pendingDepositCount = 0;
  let reservedCount = 0;
  let completedCount = 0;
  let canceledCount = 0;
  let otherStatusCount = 0;
  let travelerCount = 0;
  let revenue = 0;
  let departureStart: string | null = null;
  let departureEnd: string | null = null;

  for (const row of input.rows) {
    const status = (asString(row.booking_status) ?? "").toLowerCase();
    if (status === "pending_deposit") pendingDepositCount += 1;
    else if (status === "reserved") reservedCount += 1;
    else if (status === "completed") completedCount += 1;
    else if (status === "canceled") canceledCount += 1;
    else otherStatusCount += 1;

    travelerCount += asInteger(row.traveler_count) ?? 0;
    revenue += asInteger(row.payment_total_amount) ?? 0;

    const departure = asString(row.departure_date);
    if (departure) {
      if (!departureStart || departure < departureStart) departureStart = departure;
      if (!departureEnd || departure > departureEnd) departureEnd = departure;
    }
  }

  return {
    bookingCount: input.rows.length,
    pendingDepositCount,
    reservedCount,
    completedCount,
    canceledCount,
    otherStatusCount,
    travelerCount,
    revenue,
    period: input.period,
    productId: input.productId,
    departureDateRange: { start: departureStart, end: departureEnd },
  };
}
