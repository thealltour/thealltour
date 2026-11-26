import { normalizeNullablePriceNumber } from "@/lib/products/seasonalPriceBands";
import {
  FOREIGN_CURRENCY_AMOUNT_RE,
  FOREIGN_CURRENCY_WORD_RE,
  hasExplicitPayableKrwAmountText,
  hasForeignCurrencyAmountText,
  isForeignCurrencyOnlyPriceText,
  stripKrwReferenceConversionText,
} from "@/lib/products/optionCurrency";
import type { ProductOptions } from "@/types/product";
import type { BandParsedOption } from "@/lib/admin/bandImport/productParserSchema";

const NON_PRICE_UNIT_RE = /^(홀|인|박|명)/;

/**
 * "인/박/4만원", "2만원", "50위안(1만원)" 등에서 원화 금액 추출.
 * `$240`, `USD 240 (한화 약 33만원)`, `18홀/120위안` 등 외화(+참고 환산)만 있으면 null.
 */
export function parseKrwDeltaFromPriceText(priceText: string): number | null {
  const trimmed = priceText.trim();
  if (!trimmed) return null;

  const hasForeign = hasForeignCurrencyAmountText(trimmed);

  // 외화 + 참고 환산만 있으면(명시 원화 없음) 숫자·만원 fallback 전에 중단
  if (hasForeign && !hasExplicitPayableKrwAmountText(trimmed)) {
    return null;
  }

  // 외화가 있을 때만 참고 환산 구문 제거. 원화 전용(예: 인/박/한화 4만원)은 trimmed 그대로 파싱
  const payableText = hasForeign
    ? stripKrwReferenceConversionText(trimmed) || trimmed
    : trimmed;

  const manWonMatch = payableText.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manWonMatch) {
    const n = Number(manWonMatch[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 10000);
  }

  const wonMatch = payableText.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (wonMatch) {
    return normalizeNullablePriceNumber(wonMatch[1].replace(/,/g, ""));
  }

  if (isForeignCurrencyOnlyPriceText(trimmed)) {
    return null;
  }

  for (const match of payableText.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const after = payableText.slice(end);
    if (NON_PRICE_UNIT_RE.test(after)) continue;

    const window = payableText.slice(Math.max(0, start - 6), Math.min(payableText.length, end + 6));
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
