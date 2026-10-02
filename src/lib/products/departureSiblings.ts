import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import {
  buildSelectedDepartureFromYmd,
  findDepartureScheduleForYmd,
} from "@/lib/products/matchDepartureScheduleByYmd";
import { normalizeDepartureSchedulesFromUnknown } from "@/lib/products/normalizeDepartureSchedules";
import {
  collectProductDepartureDates,
  type ProductDepartureDateSource,
} from "@/lib/products/productDepartureDates";

/** 같은 상품을 출발지별로 나눈 형제 상품 (현재 상품 포함) */
export type ProductDepartureSibling = {
  id: string;
  departureCity: string;
  duration: string | null;
  /** 출발일 스케줄 최저가, 없으면 기본가 */
  fromPrice: number | null;
  isCurrent: boolean;
};

/** 관리자 편집기 형제 목록 (비노출 포함, 현재 상품 제외) */
export type AdminDepartureSibling = {
  id: string;
  title: string;
  departure_city: string | null;
  is_active: boolean;
};

export const DEPARTURE_SIBLINGS_SELECT = "id, departure_city, duration, price, departure_schedules_json";

export const DEPARTURE_QUERY_KEYS = {
  DATE: "date",
  PAX: "pax",
} as const;

const CITY_ORDER = ["인천", "김포", "부산", "대구", "청주", "광주", "무안", "양양", "제주"];

function cityRank(city: string): number {
  const index = CITY_ORDER.indexOf(city);
  return index >= 0 ? index : CITY_ORDER.length;
}

function lowestSchedulePrice(raw: unknown): number | null {
  const schedules = normalizeDepartureSchedulesFromUnknown(raw) ?? [];
  const prices = schedules
    .filter((schedule) => schedule.status !== "SOLD_OUT")
    .map((schedule) => schedule.price)
    .filter((price): price is number => typeof price === "number" && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * DB 행을 출발지 칩용 목록으로 바꾼다.
 * 출발지가 비어 있는 행은 칩 라벨을 만들 수 없어 제외하고, 2개 미만이면 빈 배열(칩 미노출).
 */
export function buildDepartureSiblings(
  rows: Array<Record<string, unknown>>,
  currentId: string,
): ProductDepartureSibling[] {
  const siblings: ProductDepartureSibling[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
    const city = typeof row.departure_city === "string" ? row.departure_city.trim() : "";
    if (!id || !city) continue;
    const basePrice = typeof row.price === "number" && row.price > 0 ? row.price : null;
    siblings.push({
      id,
      departureCity: city,
      duration: typeof row.duration === "string" && row.duration.trim() ? row.duration.trim() : null,
      fromPrice: lowestSchedulePrice(row.departure_schedules_json) ?? basePrice,
      isCurrent: id === currentId,
    });
  }
  if (siblings.length < 2 || !siblings.some((sibling) => sibling.isCurrent)) return [];
  return siblings.sort(
    (a, b) => cityRank(a.departureCity) - cityRank(b.departureCity) || a.departureCity.localeCompare(b.departureCity, "ko"),
  );
}

/** 출발지 전환 시 현재 출발일·인원을 형제 상품으로 넘기는 URL */
export function buildDepartureSwitchHref(
  siblingId: string,
  carry: { ymd?: string | null; travelerCount?: number | null },
): string {
  const params = new URLSearchParams();
  if (carry.ymd) params.set(DEPARTURE_QUERY_KEYS.DATE, carry.ymd);
  if (typeof carry.travelerCount === "number") params.set(DEPARTURE_QUERY_KEYS.PAX, String(carry.travelerCount));
  const query = params.toString();
  return query ? `/products/${siblingId}?${query}` : `/products/${siblingId}`;
}

function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export function parseCarriedTravelerCount(raw: string | string[] | undefined): number | null {
  const value = firstParam(raw);
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  return Number(value);
}

export function parseCarriedDepartureYmd(raw: string | string[] | undefined): string | null {
  const value = firstParam(raw);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * 형제 상품에서 넘어온 출발일을 이 상품의 달력 선택으로 복원한다.
 * 같은 날짜가 없거나 마감이면 null (호출 측에서 다시 선택 안내).
 */
export function resolveCarriedDeparture(
  product: ProductDepartureDateSource,
  ymd: string,
): { departure: SelectedDeparture; key: string } | null {
  if (!collectProductDepartureDates(product).includes(ymd)) return null;
  const schedule = findDepartureScheduleForYmd(product.departureSchedules, ymd);
  if (schedule?.status === "SOLD_OUT") return null;
  return buildSelectedDepartureFromYmd({
    ymd,
    schedules: product.departureSchedules,
    departures: product.departures,
  });
}
