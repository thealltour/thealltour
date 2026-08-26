import type { ProductDepartureSchedule } from "@/types/product";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";

const SCHEDULE_STATUSES = ["AVAILABLE", "LIMITED", "SOLD_OUT"] as const;
type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

function parseScheduleStatus(raw: unknown): ScheduleStatus | null {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  return SCHEDULE_STATUSES.includes(upper as ScheduleStatus) ? (upper as ScheduleStatus) : null;
}

function toPositiveInt(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function readString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function normalizeScheduleRow(raw: unknown): ProductDepartureSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const departureRaw =
    readString(row.departureDate) ??
    readString(row.departure_date) ??
    readString(row.departure);
  if (!departureRaw) return null;

  const departureYmd = normalizeProductDepartureDateToYmd(departureRaw);
  const departureDate = departureYmd ?? departureRaw;

  const returnRaw = readString(row.returnDate) ?? readString(row.return_date);
  const returnYmd = returnRaw ? normalizeProductDepartureDateToYmd(returnRaw) : null;
  const returnDate = returnYmd ?? returnRaw;

  const price = toPositiveInt(row.price);
  const label = readString(row.label);
  const status = parseScheduleStatus(row.status);

  return {
    departureDate,
    returnDate: returnDate ?? null,
    price: price ?? null,
    label: label ?? null,
    status,
  };
}

export function normalizeDepartureSchedulesFromUnknown(
  raw: unknown,
): ProductDepartureSchedule[] | undefined {
  if (raw == null) return undefined;

  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      arr = Array.isArray(parsed) ? parsed : null;
    } catch {
      return undefined;
    }
  }

  if (!arr?.length) return undefined;

  const schedules = arr
    .map((item) => normalizeScheduleRow(item))
    .filter((item): item is ProductDepartureSchedule => item !== null);

  return schedules.length > 0 ? schedules : undefined;
}

export function departureSchedulesToJsonColumn(
  schedules: ProductDepartureSchedule[] | null | undefined,
): ProductDepartureSchedule[] | null {
  if (!schedules?.length) return null;

  const normalized = schedules
    .map((schedule) => {
      const departureDate =
        normalizeProductDepartureDateToYmd(schedule.departureDate) ?? schedule.departureDate.trim();
      if (!departureDate) return null;

      const returnRaw = schedule.returnDate?.trim();
      const returnDate = returnRaw
        ? normalizeProductDepartureDateToYmd(returnRaw) ?? returnRaw
        : null;

      const price = toPositiveInt(schedule.price);
      const label = schedule.label?.trim() || null;
      const status = schedule.status ?? null;

      return {
        departureDate,
        returnDate,
        price,
        label,
        status,
      } as ProductDepartureSchedule;
    })
    .filter((item): item is ProductDepartureSchedule => item !== null);

  return normalized.length > 0 ? normalized : null;
}

/** UI 칩·레거시 departures[] 파생용 (가격 제외, 날짜/라벨만) */
export function deriveDeparturesFromSchedules(
  schedules: ProductDepartureSchedule[] | undefined,
): string[] | undefined {
  if (!schedules?.length) return undefined;

  const labels = schedules.map((schedule) => schedule.label?.trim() || schedule.departureDate.trim());
  const unique = [...new Set(labels.filter(Boolean))];
  return unique.length > 0 ? unique : undefined;
}

export function getDepartureSchedulesMinPrice(
  schedules: ProductDepartureSchedule[] | undefined,
): number | null {
  if (!schedules?.length) return null;
  const prices = schedules
    .map((s) => toPositiveInt(s.price))
    .filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function formatDepartureScheduleChipLabel(schedule: ProductDepartureSchedule): string {
  const dateLabel = schedule.label?.trim() || schedule.departureDate.trim();
  if (schedule.price != null && schedule.price > 0) {
    return `${dateLabel} · ${schedule.price.toLocaleString("ko-KR")}원`;
  }
  return dateLabel;
}

/**
 * 결제·문의용 값. 표시용 label이 아닌 정규화된 departureDate(YYYY-MM-DD 우선)를 사용한다.
 * label(예: 09.23)만 쓰면 연도 유실·가격 숫자 연도 오인으로 prepare가 실패한다.
 */
export function formatDepartureScheduleInquiryValue(schedule: ProductDepartureSchedule): string {
  const normalized =
    normalizeProductDepartureDateToYmd(schedule.departureDate) ||
    normalizeProductDepartureDateToYmd(schedule.label) ||
    schedule.departureDate.trim();
  if (schedule.price != null && schedule.price > 0) {
    return `${normalized} (${schedule.price.toLocaleString("ko-KR")}원)`;
  }
  return normalized;
}

/** 스케줄에서 결제용 YYYY-MM-DD 추출 */
export function resolveDepartureScheduleYmd(schedule: ProductDepartureSchedule): string | null {
  return (
    normalizeProductDepartureDateToYmd(schedule.departureDate) ||
    normalizeProductDepartureDateToYmd(schedule.label)
  );
}
