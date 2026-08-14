import { isIsoDateYmd } from "@/lib/inquiry/desiredDeparture";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { formatStickyDateYmd } from "@/lib/products/productFixedDeparture";

export function resolveStickyExpectedAmount(params: {
  selectedDeparturePrice?: number | null;
  quoteTotal?: number | null;
  quoteBasePrice?: number | null;
}): { amount: number; fromDeparture: boolean } | null {
  const optionDelta =
    params.quoteTotal != null && params.quoteBasePrice != null
      ? params.quoteTotal - params.quoteBasePrice
      : 0;
  if (params.selectedDeparturePrice != null && params.selectedDeparturePrice > 0) {
    return {
      amount: params.selectedDeparturePrice + optionDelta,
      fromDeparture: true,
    };
  }
  if (params.quoteTotal != null) {
    return { amount: params.quoteTotal, fromDeparture: false };
  }
  return null;
}

const PRICE_SUFFIX_RE = /\s*·\s*[\d,]+원(?:\s*\([^)]*\))?$/;
const PAREN_PRICE_RE = /\s*\([\d,]+원\)$/;

function stripPriceDecorations(raw: string): string {
  return raw.replace(PRICE_SUFFIX_RE, "").replace(PAREN_PRICE_RE, "").trim();
}

function ymdFromDepartureText(raw: string): string | null {
  const stripped = stripPriceDecorations(raw);
  if (isIsoDateYmd(raw)) return raw;
  if (isIsoDateYmd(stripped)) return stripped;
  return normalizeProductDepartureDateToYmd(raw) ?? normalizeProductDepartureDateToYmd(stripped);
}

export function getSelectedDepartureStickyDateLabel(
  selected: { inquiryValue?: string | null; label?: string | null } | null | undefined,
): string {
  if (!selected) return "";
  const candidates = [selected.inquiryValue, selected.label]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  for (const raw of candidates) {
    const ymd = ymdFromDepartureText(raw);
    if (ymd) return formatStickyDateYmd(ymd);
  }
  const fallback = candidates[0] ?? "";
  return stripPriceDecorations(fallback);
}
