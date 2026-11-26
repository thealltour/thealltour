import { normalizeNullablePriceNumber } from "@/lib/products/seasonalPriceBands";
import {
  FOREIGN_CURRENCY_AMOUNT_RE,
  FOREIGN_CURRENCY_WORD_RE,
  hasForeignCurrencyAmountText,
  hasKrwAmountText,
  isForeignCurrencyOnlyPriceText,
} from "@/lib/products/optionCurrency";
import type { ProductOptions } from "@/types/product";
import type { BandParsedOption } from "@/lib/admin/bandImport/productParserSchema";

const NON_PRICE_UNIT_RE = /^(홀|인|박|명)/;

/**
 * "인/박/4만원", "2만원", "50위안(1만원)" 등에서 원화 금액 추출.
 * `$240`, `18홀/120위안` 등 외화만 있으면 null (KRW priceDelta 금지).
 */
export function parseKrwDeltaFromPriceText(priceText: string): number | null {
  const trimmed = priceText.trim();
  if (!trimmed) return null;

  // 1) 명시적 원화 (외화+원화 병기 시에도 원화 우선 — 예: 50위안(1만원))
  const manWonMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manWonMatch) {
    const n = Number(manWonMatch[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 10000);
  }

  const wonMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (wonMatch) {
    return normalizeNullablePriceNumber(wonMatch[1].replace(/,/g, ""));
  }

  // 2) 외화만 있으면 숫자 fallback 전에 중단
  if (isForeignCurrencyOnlyPriceText(trimmed)) {
    return null;
  }

  // 3) 외화 금액 토큰이 섞여 있으면 그 숫자는 KRW로 쓰지 않음
  if (hasForeignCurrencyAmountText(trimmed) && !hasKrwAmountText(trimmed)) {
    return null;
  }

  for (const match of trimmed.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const after = trimmed.slice(end);
    if (NON_PRICE_UNIT_RE.test(after)) continue;

    // `$240` / `USD 240` / `¥120` 등: 숫자 앞뒤가 외화 기호·코드면 skip
    const window = trimmed.slice(Math.max(0, start - 6), Math.min(trimmed.length, end + 6));
    if (FOREIGN_CURRENCY_AMOUNT_RE.test(window) || FOREIGN_CURRENCY_WORD_RE.test(window)) {
      continue;
    }

    return normalizeNullablePriceNumber(match[0].replace(/,/g, ""));
  }

  return null;
}

export function mapBandOptionsToProductOptions(
  options: BandParsedOption[] | null | undefined,
  basePrice: number | null,
): ProductOptions | null {
  if (!options?.length) return null;

  const items = options
    .map((opt, index) => {
      const name = opt.name?.trim();
      const priceText = opt.priceText?.trim();
      if (!name) return null;

      const priceDelta = priceText ? parseKrwDeltaFromPriceText(priceText) : null;
      const item: ProductOptions["groups"][number]["items"][number] = {
        value: `surcharge-${index}`,
        label: name,
      };
      if (priceText) item.meta = priceText;
      if (priceDelta != null) {
        item.priceDelta = priceDelta;
      } else if (priceText && isForeignCurrencyOnlyPriceText(priceText)) {
        item.consultOnly = true;
      }
      return item;
    })
    .filter(
      (item): item is ProductOptions["groups"][number]["items"][number] => item !== null,
    );

  if (items.length === 0) return null;

  return {
    basePrice: basePrice ?? 0,
    currency: "KRW",
    groups: [
      {
        key: "surcharges",
        title: "추가 옵션·할증",
        type: "multi",
        items,
      },
    ],
  };
}
