"use client";

import type { Product } from "@/types/product";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateWithWeekday(dateStr: string | undefined): string {
  if (!dateStr?.trim()) return "";
  const s = dateStr.trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    const day = WEEKDAY[d.getDay()];
    return `${match[1]}.${match[2]}.${match[3]}(${day})`;
  }
  if (s.includes(".") || s.includes("(")) return s;
  return s;
}

function hasDepartureFlight(p: Product | null): boolean {
  if (!p) return false;
  return !!(
    p.departure_from_airport?.trim() ||
    p.departure_to_airport?.trim() ||
    p.departure_flight_name?.trim()
  );
}

function hasArrivalFlight(p: Product | null): boolean {
  if (!p) return false;
  return !!(
    p.arrival_from_airport?.trim() ||
    p.arrival_to_airport?.trim() ||
    p.arrival_flight_name?.trim()
  );
}

type FlightCardProps = {
  title: string;
  fromAirport: string;
  fromDate: string;
  fromTime: string;
  flightName: string;
  toAirport: string;
  toDate: string;
  toTime: string;
  toTimeExtra?: string;
};

function FlightCard({
  title,
  fromAirport,
  fromDate,
  fromTime,
  flightName,
  toAirport,
  toDate,
  toTime,
  toTimeExtra,
}: FlightCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold text-[#1e3a8a]">{title}</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-slate-800">{fromAirport}</p>
          {fromDate && <p className="text-xs text-slate-500">{fromDate}</p>}
          <p className="mt-1 text-xl font-bold text-slate-900">{fromTime}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5 border-y border-slate-200 py-2 px-3">
          <AirlineLogo airlineText={flightName} size={40} />
          <span className="text-center text-xs font-semibold text-slate-600">{flightName}</span>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-sm font-semibold text-slate-800">{toAirport}</p>
          {toDate && <p className="text-xs text-slate-500">{toDate}</p>}
          <div className="mt-1">
            {toTimeExtra && (
              <span className="block text-xs font-medium text-slate-500">{toTimeExtra}</span>
            )}
            <p className="text-xl font-bold text-slate-900">{toTime}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export type FlightSummarySectionProps = {
  product: Product | null;
};

/**
 * 출발/도착 항공편 카드 (여행 오버뷰 위에 별도 배치)
 * - 데이터 없으면 렌더하지 않음
 */
export function FlightSummarySection({ product }: FlightSummarySectionProps) {
  if (!product) return null;

  const hasDepart = hasDepartureFlight(product);
  const hasArrival = hasArrivalFlight(product);
  if (!hasDepart && !hasArrival) return null;

  const depFrom = product.departure_from_airport?.trim() || "";
  const depTo = product.departure_to_airport?.trim() || "";
  const depFromDate = formatDateWithWeekday(product.departure_from_date);
  const depToDate = formatDateWithWeekday(product.departure_to_date);
  const depFromTime = product.departure_from_time?.trim() || "";
  const depToTime = product.departure_to_time?.trim() || "";
  const depFlight = product.departure_flight_name?.trim() || "";

  const arrFrom = product.arrival_from_airport?.trim() || "";
  const arrTo = product.arrival_to_airport?.trim() || "";
  const arrFromDate = formatDateWithWeekday(product.arrival_from_date);
  const arrToDate = formatDateWithWeekday(product.arrival_to_date);
  const arrFromTime = product.arrival_from_time?.trim() || "";
  const arrToTime = product.arrival_to_time?.trim() || "";
  const arrFlight = product.arrival_flight_name?.trim() || "";

  const depFromLabel = depFrom ? `${depFrom} 출발` : "출발";
  const depToLabel = depTo ? `${depTo} 도착` : "도착";
  const arrFromLabel = arrFrom ? `${arrFrom} 출발` : "출발";
  const arrToLabel = arrTo ? `${arrTo} 도착` : "도착";

  const depToTimeExtra =
    depFromDate && depToDate && depFromDate !== depToDate ? "+1일" : undefined;

  return (
    <section
      className="w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50"
      aria-label="항공편"
    >
      <div className="p-6 md:p-8">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">항공</h2>
        <p className="mt-1 text-sm text-slate-500">출발·도착 항공편 정보입니다.</p>
        <div className="mt-6 space-y-4">
          {hasDepart && (
            <FlightCard
              title="출발 항공편"
              fromAirport={depFromLabel}
              fromDate={depFromDate}
              fromTime={depFromTime}
              flightName={depFlight || "—"}
              toAirport={depToLabel}
              toDate={depToDate}
              toTime={depToTime}
              toTimeExtra={depToTimeExtra}
            />
          )}
          {hasArrival && (
            <FlightCard
              title="도착 항공편"
              fromAirport={arrFromLabel}
              fromDate={arrFromDate}
              fromTime={arrFromTime}
              flightName={arrFlight || "—"}
              toAirport={arrToLabel}
              toDate={arrToDate}
              toTime={arrToTime}
            />
          )}
        </div>
      </div>
    </section>
  );
}
