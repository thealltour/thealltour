import type { ProductOptionItem, ProductOptions, SelectedOptions } from "@/types/product";

/** 원화 표기 (만원·원). 괄호 안 환산 포함 — 예: 50위안(1만원) */
export const KRW_AMOUNT_RE = /만\s*원?|(?:\d{1,3}(?:,\d{3})+|\d+)\s*원/;

/**
 * 외화에 붙는 참고 환산액.
 * 예: `한화 약 33만원`, `(한화 약 33만원)`, `약 33만원`
 * → 온라인 KRW priceDelta / 결제 옵션으로 쓰지 않는다.
 */
const KRW_REFERENCE_CONVERSION_PATTERN =
  String.raw`\(?\s*한화\s*약?\s*\d+(?:\.\d+)?\s*만\s*원?\s*\)?|\(?\s*한화\s*약?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*원\s*\)?|\(?\s*약\s*\d+(?:\.\d+)?\s*만\s*원?\s*\)?|\(?\s*약\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*원\s*\)?`;

export function createKrwReferenceConversionRe(): RegExp {
  return new RegExp(KRW_REFERENCE_CONVERSION_PATTERN, "gi");
}

/**
 * 외화 금액 표기.
 * `$240`, `US$240`, `USD 240`, `CAD$55`, `AUD$80`, `¥120`, `￥120`, `€50`, `£50`, 위안/元/엔 등.
 * `¥`/`￥`는 원문 그대로 두고 KRW로 해석하지 않는다.
 */
export const FOREIGN_CURRENCY_AMOUNT_RE =
  /(?:(?:CAD|AUD|US)\s*\$|(?:USD|CAD|AUD|CNY|JPY|EUR|GBP)\s*|\$)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:위안|元|엔|달러)|[¥￥€£]\s*[\d,]+(?:\.\d+)?/i;

export const FOREIGN_CURRENCY_WORD_RE = /위안|元|엔|달러|CNY|USD|CAD|AUD|JPY|EUR|GBP/i;

const FOREIGN_CODE_AMOUNT_RE =
  /\b(CAD|AUD|USD|EUR|GBP|CNY|JPY)\s*\$?\s*([\d,]+(?:\.\d+)?)/i;
const FOREIGN_PREFIXED_DOLLAR_RE = /\b(CAD|AUD|US)\s*\$\s*([\d,]+(?:\.\d+)?)/i;
const BARE_DOLLAR_AMOUNT_RE = /\$\s*([\d,]+(?:\.\d+)?)/;

export function hasKrwAmountText(text: string): boolean {
  return KRW_AMOUNT_RE.test(text);
}

export function hasForeignCurrencyAmountText(text: string): boolean {
  return FOREIGN_CURRENCY_AMOUNT_RE.test(text) || FOREIGN_CURRENCY_WORD_RE.test(text);
}

/** 참고 환산 구문을 제거한 뒤의 텍스트 */
export function stripKrwReferenceConversionText(text: string): string {
  return text.replace(createKrwReferenceConversionRe(), " ").replace(/\s+/g, " ").trim();
}

/**
 * 온라인 결제에 쓸 수 있는 명시적 원화 금액이 있는지.
 * `50위안(1만원)` → true / `USD 240 (한화 약 33만원)` → false
 */
export function hasExplicitPayableKrwAmountText(text: string): boolean {
  const withoutRef = stripKrwReferenceConversionText(text);
  if (!withoutRef) return false;
  return hasKrwAmountText(withoutRef);
}

/**
 * 외화 금액이 본문이고, 결제용 명시 원화가 없으면 true.
 * 참고 환산(`한화 약 …`)만 있어도 true → 상담 전용.
 */
export function isForeignCurrencyOnlyPriceText(priceText: string | null | undefined): boolean {
  const trimmed = priceText?.trim() ?? "";
  if (!trimmed) return false;
  if (!hasForeignCurrencyAmountText(trimmed)) return false;
  if (hasExplicitPayableKrwAmountText(trimmed)) return false;
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

function resolveConsultGuideScope(text: string): string[] {
  const nights = text.match(/(\d+)\s*박/);
  const perPerson = /(?:^|[^\d])인(?:[^\d]|$)/.test(text) || /1인/.test(text);
  const scope: string[] = [];
  if (perPerson && nights) scope.push(`1인·${nights[1]}박 기준`);
  else if (nights) scope.push(`${nights[1]}박 기준`);
  else if (perPerson && /전일정/.test(text)) scope.push("1인·전일정 기준");
  else if (perPerson) scope.push("1인 기준");
  return scope;
}

function formatCodedForeignGuide(text: string, code: string, amount: string): string {
  const scope = resolveConsultGuideScope(text);
  const head = scope.length > 0 ? `${scope.join(" · ")} ${code} ${amount}` : `${code} ${amount}`;
  return `${head} · 상담 문의`;
}

/**
 * 상담 전용 안내 문구.
 * - `인/3박/$240` → `1인·3박 기준 USD 240 · 상담 문의`
 * - `CAD$55` / `AUD$80` → `CAD 55` / `AUD 80` (USD로 오인하지 않음)
 */
export function formatConsultOnlyOptionGuide(item: ProductOptionItem): string {
  const text = [item.meta, item.label].filter(Boolean).join(" ");

  const prefixed = text.match(FOREIGN_PREFIXED_DOLLAR_RE);
  if (prefixed) {
    const rawCode = prefixed[1].toUpperCase();
    const code = rawCode === "US" ? "USD" : rawCode;
    return formatCodedForeignGuide(text, code, prefixed[2].replace(/,/g, ""));
  }

  const coded = text.match(FOREIGN_CODE_AMOUNT_RE);
  if (coded) {
    return formatCodedForeignGuide(text, coded[1].toUpperCase(), coded[2].replace(/,/g, ""));
  }

  const bareDollar = text.match(BARE_DOLLAR_AMOUNT_RE);
  if (bareDollar) {
    return formatCodedForeignGuide(text, "USD", bareDollar[1].replace(/,/g, ""));
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
