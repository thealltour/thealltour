import { normalizeNullablePriceNumber } from "@/lib/products/seasonalPriceBands";
import type { ProductOptions } from "@/types/product";
import type { BandParsedOption } from "@/lib/admin/bandImport/productParserSchema";

/** "인/박/4만원", "2만원" 등에서 원화 금액 추출 */
export function parseKrwDeltaFromPriceText(priceText: string): number | null {
  const trimmed = priceText.trim();
  if (!trimmed) return null;

  const manWonMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manWonMatch) {
    const n = Number(manWonMatch[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 10000);
  }

  const wonMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (wonMatch) {
    return normalizeNullablePriceNumber(wonMatch[1].replace(/,/g, ""));
  }

  const digitsOnly = trimmed.match(/\d{1,3}(?:,\d{3})+|\d+/);
  if (digitsOnly) {
    return normalizeNullablePriceNumber(digitsOnly[0].replace(/,/g, ""));
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
      if (priceDelta != null) item.priceDelta = priceDelta;
      return item;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

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
