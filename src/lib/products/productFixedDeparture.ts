import type { ProductCardSource } from "@/lib/products/productListItem";
import type { Product } from "@/types/product";
import { WEEKDAYS_KO as WEEKDAY } from "@/lib/datetime/isoDate";

function formatYmdDisplay(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return `${m[1]}.${m[2]}.${m[3]}(${WEEKDAY[d.getDay()]})`;
}

/** 출발일이 특정 날짜로 고정된 상품 (항공 출발일·departures 등) */
export function hasProductFixedDeparture(product: ProductCardSource | null | undefined): boolean {
  if (!product) return false;
  if (product.departure_from_date?.trim()) return true;
  return (product.departures ?? []).some((d) => typeof d === "string" && d.trim() !== "");
}

/** 스티키·요약용 출발일 표시 (범위 또는 단일일) */
export function getProductFixedDepartureDateLabel(product: Product | null | undefined): string {
  if (!product) return "";
  const from = product.departure_from_date?.trim();
  const to = product.departure_to_date?.trim();
  if (from && to) {
    if (from === to) return formatYmdDisplay(from);
    const start = formatYmdDisplay(from);
    const mTo = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mTo && from.startsWith(mTo[1])) {
      const d = new Date(parseInt(mTo[1], 10), parseInt(mTo[2], 10) - 1, parseInt(mTo[3], 10));
      return `${start} ~ ${mTo[2]}.${mTo[3]}(${WEEKDAY[d.getDay()]})`;
    }
    return `${start} ~ ${formatYmdDisplay(to)}`;
  }
  if (from) return formatYmdDisplay(from);
  const first = product.departures?.find((d) => d?.trim());
  return first ? formatYmdDisplay(first.trim()) : "";
}

export function formatStickyDateYmd(s: string): string {
  return formatYmdDisplay(s);
}

/** duration · price_meta 앞에 고정 출발일을 붙인 메타 줄 */
export function buildProductStickyMetaLine(
  product: Product | null | undefined,
  options?: {
    includePriceMeta?: boolean;
    seasonalMode?: boolean;
    selectedDateLabel?: string | null;
  },
): string {
  if (!product) return "";
  const selected = options?.selectedDateLabel?.trim() ?? "";
  const dateLabel = selected
    ? selected
    : hasProductFixedDeparture(product)
      ? getProductFixedDepartureDateLabel(product)
      : "";
  const parts: string[] = [];
  if (dateLabel) parts.push(dateLabel);
  const duration = product.duration?.trim();
  if (duration) parts.push(duration);
  if (!options?.seasonalMode && options?.includePriceMeta !== false) {
    const priceMeta = product.price_meta?.trim() || "1인 기준";
    parts.push(priceMeta);
  }
  return parts.join(" · ");
}
