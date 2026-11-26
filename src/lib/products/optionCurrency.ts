import type { ProductOptionItem, ProductOptions, SelectedOptions } from "@/types/product";

/** 원화 표기 (만원·원). 괄호 안 환산 포함 — 예: 50위안(1만원) */
export const KRW_AMOUNT_RE = /만\s*원?|(?:\d{1,3}(?:,\d{3})+|\d+)\s*원/;

/**
 * 외화 금액 표기.
 * `$240`, `US$240`, `USD 240`, `¥120`, `￥120`, `€50`, `£50`, 위안/元/엔/CNY/JPY 등.
 * `¥`/`￥`는 원문 그대로 두고 KRW로 해석하지 않는다.
 */
export const FOREIGN_CURRENCY_AMOUNT_RE =
  /(?:US\s*\$|USD\s*|\$)\s*[\d,]+(?:\.\d+)?|(?:CNY|JPY|EUR|GBP)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:위안|元|엔|달러)|[¥￥€£]\s*[\d,]+(?:\.\d+)?/i;

export const FOREIGN_CURRENCY_WORD_RE = /위안|元|엔|달러|CNY|USD|JPY|EUR|GBP/i;

export function hasKrwAmountText(text: string): boolean {
  return KRW_AMOUNT_RE.test(text);
}

export function hasForeignCurrencyAmountText(text: string): boolean {
  return FOREIGN_CURRENCY_AMOUNT_RE.test(text) || FOREIGN_CURRENCY_WORD_RE.test(text);
}

/** 외화만 있고 원화 금액이 없으면 true (KRW priceDelta 금지) */
export function isForeignCurrencyOnlyPriceText(priceText: string | null | undefined): boolean {
  const trimmed = priceText?.trim() ?? "";
  if (!trimmed) return false;
  if (!hasForeignCurrencyAmountText(trimmed)) return false;
  if (hasKrwAmountText(trimmed)) return false;
  return true;
}

export function isConsultOnlyProductOption(item: ProductOptionItem): boolean {
  if (item.consultOnly === true) return true;
  const text = [item.meta, item.label].filter(Boolean).join(" ");
  return isForeignCurrencyOnlyPriceText(text);
}

/** 온라인 합계·체크아웃에 쓸 수 있는 원화 delta (상담 전용이면 0) */
export function resolveOnlineOptionPriceDelta(item: ProductOptionItem): number {
  if (isConsultOnlyProductOption(item)) return 0;
  return typeof item.priceDelta === "number" ? item.priceDelta : 0;
}

/**
 * 상담 전용 안내 문구.
 * 예: meta `인/3박/$240` → `1인·3박 기준 USD 240 · 상담 문의`
 */
export function formatConsultOnlyOptionGuide(item: ProductOptionItem): string {
  const text = [item.meta, item.label].filter(Boolean).join(" ");
  const usd = text.match(/(?:US\s*\$|USD\s*|\$)\s*([\d,]+(?:\.\d+)?)/i);
  if (usd) {
    const amount = usd[1].replace(/,/g, "");
    const nights = text.match(/(\d+)\s*박/);
    const perPerson = /(?:^|[^\d])인(?:[^\d]|$)/.test(text) || /1인/.test(text);
    const scope: string[] = [];
    if (perPerson && nights) scope.push(`1인·${nights[1]}박 기준`);
    else if (nights) scope.push(`${nights[1]}박 기준`);
    else if (perPerson && /전일정/.test(text)) scope.push("1인·전일정 기준");
    else if (perPerson) scope.push("1인 기준");
    const head = scope.length > 0 ? `${scope.join(" · ")} USD ${amount}` : `USD ${amount}`;
    return `${head} · 상담 문의`;
  }

  const foreign =
    text.match(/([¥￥€£])\s*([\d,]+(?:\.\d+)?)/)?.[0]?.replace(/\s+/g, "") ||
    text.match(/([\d,]+(?:\.\d+)?)\s*(?:위안|元|엔|달러)/i)?.[0] ||
    text.match(/(?:CNY|JPY|EUR|GBP)\s*[\d,]+(?:\.\d+)?/i)?.[0];
  if (foreign) {
    return `${foreign.trim()} · 상담 문의`;
  }
  if (item.meta?.trim()) return `${item.meta.trim()} · 상담 문의`;
  return "상담 문의";
}

export function findConsultOnlySelectedOptions(
  options: ProductOptions | null | undefined,
  selected: SelectedOptions | null | undefined,
): Array<{ groupKey: string; itemValue: string; label: string }> {
  if (!options?.groups?.length || !selected) return [];
  const hits: Array<{ groupKey: string; itemValue: string; label: string }> = [];
  for (const group of options.groups) {
    const raw = selected[group.key];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const value of values) {
      const item = group.items.find((entry) => entry.value === value);
      if (item && isConsultOnlyProductOption(item)) {
        hits.push({ groupKey: group.key, itemValue: value, label: item.label });
      }
    }
  }
  return hits;
}

/** 상담 전용 선택값을 제거한 SelectedOptions */
export function stripConsultOnlySelections(
  options: ProductOptions | null | undefined,
  selected: SelectedOptions,
): SelectedOptions {
  if (!options?.groups?.length) return selected;
  const next: SelectedOptions = { ...selected };
  for (const group of options.groups) {
    const raw = next[group.key];
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      const filtered = raw.filter((value) => {
        const item = group.items.find((entry) => entry.value === value);
        return !item || !isConsultOnlyProductOption(item);
      });
      if (filtered.length === 0) delete next[group.key];
      else next[group.key] = filtered;
    } else {
      const item = group.items.find((entry) => entry.value === raw);
      if (item && isConsultOnlyProductOption(item)) delete next[group.key];
    }
  }
  return next;
}
