import type { ProductOptions, ProductOptionGroup, ProductOptionItem, SelectedOptions } from "@/types/product";

export type QuoteBreakdownItem = {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  priceDelta: number;
  durationLabel?: string;
};

export type QuoteResult = {
  /** 합계 금액(원). basePrice + 선택 항목 priceDelta 합 */
  total: number | null;
  /** 기준가(원). options.basePrice */
  basePrice: number | null;
  /** 선택된 항목만 포함 */
  breakdown: QuoteBreakdownItem[];
  /** 표시용 기간. 옵션에서 meta 등으로 확장 가능 시 사용, 현재는 null */
  durationLabel: string | null;
};

function findItemByValue(group: ProductOptionGroup, value: string): ProductOptionItem | null {
  const found = group.items.find((o) => o.value === value);
  return found ?? null;
}

/**
 * 옵션 그룹 배열 반환 (정렬 필요 시 groups 순서 유지 또는 추후 sortOrder 확장)
 */
export function sortOptionGroups(options: ProductOptions): ProductOptionGroup[] {
  return options.groups ?? [];
}

/**
 * 기준가 + 선택된 옵션으로 견적 계산.
 * - total = basePrice + sum(선택된 items의 priceDelta)
 * - breakdown에는 선택된 항목만 포함
 * - options가 없거나 groups가 비어 있으면 total = basePrice, breakdown = []
 */
export function calcQuote(
  options: ProductOptions | undefined,
  selected: SelectedOptions
): QuoteResult {
  if (!options?.groups?.length) {
    const base = options?.basePrice ?? null;
    return {
      total: base,
      basePrice: base,
      breakdown: [],
      durationLabel: null,
    };
  }

  const breakdown: QuoteBreakdownItem[] = [];
  let total = options.basePrice;

  for (const group of options.groups) {
    const itemValue = selected[group.key];
    if (!itemValue) continue;

    const item = findItemByValue(group, itemValue);
    if (!item) continue;

    const delta = typeof item.priceDelta === "number" ? item.priceDelta : 0;
    breakdown.push({
      groupId: group.key,
      groupLabel: group.title,
      optionId: item.value,
      optionLabel: item.label,
      priceDelta: delta,
    });
    total += delta;
  }

  return {
    total,
    basePrice: options.basePrice,
    breakdown,
    durationLabel: null,
  };
}

/**
 * 금액을 한국 원화 포맷 문자열로 반환.
 */
export function formatPriceKR(amount: number | null | undefined): string | null {
  if (amount == null || typeof amount !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(amount);
}
