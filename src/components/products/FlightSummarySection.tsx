"use client";

import type { Product } from "@/types/product";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/icons";

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

function formatBaggageLimit(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  if (/^\d+(\.\d+)?$/.test(value)) {
    return `${value}KG`;
  }
  return value;
}

function FlightMetaRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon name={icon} size={18} decorative className="shrink-0 text-slate-500" />
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

type FlightCardProps = {
  title: string;
  fromAirport: string;
  fromDate: string;
  fromTime: string;
  flightName: string;
  baggageLimit?: string;
  toAirport: string;
  toDate: string;
  toTime: string;
  toTimeExtra?: string;
  compact?: boolean;
};

type MobileFlightBlockProps = {
  label: string;
  fromAirport: string;
  toAirport: string;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  toTimeExtra?: string;
  flightName: string;
  baggageLimit?: string;
};

function MobileFlightBlock({
  label,
  fromAirport,
  toAirport,
  fromDate,
  toDate,
  fromTime,
  toTime,
  toTimeExtra,
  flightName,
  baggageLimit,
}: MobileFlightBlockProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-[var(--primary)]">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-left text-sm font-semibold text-slate-800">{fromAirport || "출발"}</p>
        <div className="flex shrink-0 px-1">
          <AirlineLogo airlineText={flightName} size={56} />
        </div>
        <p className="min-w-0 flex-1 text-right text-sm font-semibold text-slate-800">{toAirport || "도착"}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">출발</p>
          <p className="text-xl font-bold leading-tight text-slate-900">{fromTime || "—"}</p>
          {fromDate ? <p className="text-[11px] text-slate-500">{fromDate}</p> : null}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[11px] text-slate-500">도착</p>
          <p className="text-xl font-bold leading-tight text-slate-900">
            {toTime || "—"}
            {toTimeExtra ? <span className="ml-1 text-xs font-semibold text-[#1e3a8a]">{toTimeExtra}</span> : null}
          </p>
          {toDate ? <p className="text-[11px] text-slate-500">{toDate}</p> : null}
        </div>
      </div>
      <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
        <FlightMetaRow icon="flight" label="항공" value={flightName.trim() || "—"} />
        {baggageLimit?.trim() ? (
          <FlightMetaRow icon="baggage" label="수하물" value={formatBaggageLimit(baggageLimit)} />
        ) : null}
      </div>
    </div>
  );
}

function FlightCard({
  title,
  fromAirport,
  fromDate,
  fromTime,
  flightName,
  baggageLimit,
  toAirport,
  toDate,
  toTime,
  toTimeExtra,
  compact = false,
}: FlightCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <p className={`font-semibold text-[var(--primary)] ${compact ? "mb-2 text-[11px]" : "mb-3 text-xs"}`}>{title}</p>
      <div className={`flex flex-wrap items-center justify-between ${compact ? "gap-3" : "gap-4"}`}>
        <div className="min-w-0 flex-1 text-left">
          <p className={`font-semibold text-slate-800 ${compact ? "text-xs" : "text-sm"}`}>{fromAirport}</p>
          {fromDate && <p className="text-xs text-slate-500">{fromDate}</p>}
          <p className={`mt-1 font-bold text-slate-900 ${compact ? "text-lg" : "text-xl"}`}>{fromTime}</p>
        </div>
        <div className={`flex shrink-0 flex-col items-center border-y border-slate-200 ${compact ? "gap-1 py-2 px-3" : "gap-1.5 py-2.5 px-4"}`}>
          <AirlineLogo airlineText={flightName} size={compact ? 64 : 80} />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className={`font-semibold text-slate-800 ${compact ? "text-xs" : "text-sm"}`}>{toAirport}</p>
          {toDate && <p className="text-xs text-slate-500">{toDate}</p>}
          <div className="mt-1">
            {toTimeExtra && (
              <span className="block text-xs font-medium text-slate-500">{toTimeExtra}</span>
            )}
            <p className={`font-bold text-slate-900 ${compact ? "text-lg" : "text-xl"}`}>{toTime}</p>
          </div>
        </div>
      </div>
      <div className={`mt-3 space-y-2 border-t border-slate-200/80 ${compact ? "pt-2" : "pt-3"}`}>
        <FlightMetaRow icon="flight" label="항공" value={flightName.trim() || "—"} />
        {baggageLimit?.trim() ? (
          <FlightMetaRow icon="baggage" label="수하물" value={formatBaggageLimit(baggageLimit)} />
        ) : null}
      </div>
    </div>
  );
}

export type FlightSummarySectionProps = {
  product: Product | null;
  compact?: boolean;
  embedded?: boolean;
};

/**
 * 출발/도착 항공편 카드 (여행 오버뷰 위에 별도 배치)
 * - 데이터 없으면 렌더하지 않음
 */
export function FlightSummarySection({
  product,
  compact = false,
  embedded = false,
}: FlightSummarySectionProps) {
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
  const depBaggage = product.departure_baggage_limit?.trim() || "";

  const arrFrom = product.arrival_from_airport?.trim() || "";
  const arrTo = product.arrival_to_airport?.trim() || "";
  const arrFromDate = formatDateWithWeekday(product.arrival_from_date);
  const arrToDate = formatDateWithWeekday(product.arrival_to_date);
  const arrFromTime = product.arrival_from_time?.trim() || "";
  const arrToTime = product.arrival_to_time?.trim() || "";
  const arrFlight = product.arrival_flight_name?.trim() || "";
  const arrBaggage = product.arrival_baggage_limit?.trim() || "";

  const depFromLabel = depFrom ? `${depFrom} 출발` : "출발";
  const depToLabel = depTo ? `${depTo} 도착` : "도착";
  const arrFromLabel = arrFrom ? `${arrFrom} 출발` : "출발";
  const arrToLabel = arrTo ? `${arrTo} 도착` : "도착";

  const depToTimeExtra =
    depFromDate && depToDate && depFromDate !== depToDate ? "+1일" : undefined;
  const arrToTimeExtra =
    arrFromDate && arrToDate && arrFromDate !== arrToDate ? "+1일" : undefined;

  return (
    <section
      className={
        embedded
          ? "w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          : "w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50"
      }
      aria-label="항공편"
    >
      <div className={embedded ? "" : "p-6 md:p-8"}>
        <h2
          className={`inline-flex items-center gap-2 font-bold tracking-tight text-slate-900 ${compact ? "text-lg" : "text-xl md:text-2xl"}`}
        >
          <Icon name="flight" decorative size={compact ? 20 : 22} className="shrink-0 text-slate-700" />
          항공
        </h2>
        {!compact && <p className="mt-1 text-sm text-slate-500">출발·도착 항공편 정보입니다.</p>}
        <div className={compact ? "mt-3 space-y-3" : "mt-6 space-y-4"}>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:hidden">
            {hasDepart ? (
              <MobileFlightBlock
                label="출발 항공편"
                fromAirport={depFromLabel}
                toAirport={depToLabel}
                fromDate={depFromDate}
                toDate={depToDate}
                fromTime={depFromTime}
                toTime={depToTime}
                toTimeExtra={depToTimeExtra}
                flightName={depFlight || "—"}
                baggageLimit={depBaggage || undefined}
              />
            ) : null}
            {hasDepart && hasArrival ? <div className="my-3 border-t border-[var(--divider)]" /> : null}
            {hasArrival ? (
              <MobileFlightBlock
                label="도착 항공편"
                fromAirport={arrFromLabel}
                toAirport={arrToLabel}
                fromDate={arrFromDate}
                toDate={arrToDate}
                fromTime={arrFromTime}
                toTime={arrToTime}
                toTimeExtra={arrToTimeExtra}
                flightName={arrFlight || "—"}
                baggageLimit={arrBaggage || undefined}
              />
            ) : null}
          </div>

          <div className="hidden space-y-4 md:block">
            {hasDepart && (
              <FlightCard
                title="출발 항공편"
                fromAirport={depFromLabel}
                fromDate={depFromDate}
                fromTime={depFromTime}
                flightName={depFlight || "—"}
                baggageLimit={depBaggage || undefined}
                toAirport={depToLabel}
                toDate={depToDate}
                toTime={depToTime}
                toTimeExtra={depToTimeExtra}
                compact={compact}
              />
            )}
            {hasArrival && (
              <FlightCard
                title="도착 항공편"
                fromAirport={arrFromLabel}
                fromDate={arrFromDate}
                fromTime={arrFromTime}
                flightName={arrFlight || "—"}
                baggageLimit={arrBaggage || undefined}
                toAirport={arrToLabel}
                toDate={arrToDate}
                toTime={arrToTime}
                compact={compact}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
