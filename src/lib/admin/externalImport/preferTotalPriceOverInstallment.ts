/** 할부·월 납입액을 상품 총액과 구분한다. 모두투어 `예상가 ₩` 총액은 유지. */

const WON_AMOUNT_RE = /(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d{5,})\s*원?/g;

export function stripInstallmentMetaText(text: string): string {
  return text
    .split(/\n/)
    .filter((line) => {
      if (/카드사별\s*무이자/.test(line)) return false;
      if (/무이자\s*할부|할부\s*예상가/.test(line)) return false;
      if (/월\s*[\d,]+원/.test(line) && /할부|무이자|예상가/.test(line)) return false;
      if (/^\s*월\s*[\d,]+원/.test(line)) return false;
      return true;
    })
    .join("\n");
}

function parseWonAmounts(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(WON_AMOUNT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 10000) out.push(n);
  }
  return out;
}

function amountsOnInstallmentLines(text: string): Set<number> {
  const found = new Set<number>();
  for (const line of text.split(/\n/)) {
    if (!/할부|무이자|월\s*[\d,]+원/.test(line)) continue;
    for (const n of parseWonAmounts(line)) found.add(n);
  }
  return found;
}

function isNMonthInstallment(total: number, monthly: number): boolean {
  if (monthly <= 0 || total <= monthly) return false;
  const months = total / monthly;
  for (const n of [3, 4, 5, 6]) {
    if (Math.abs(months - n) <= 0.03) return true;
  }
  return false;
}

/**
 * AI가 할부 월액을 총액으로 넣은 경우 본문의 성인 1인 총액으로 되돌린다.
 * 할부 문구가 없으면 모두투어 예상가처럼 그대로 둔다.
 */
export function preferTotalPriceOverInstallment(
  parsedPrice: number | null | undefined,
  pageText: string,
): number | null {
  if (parsedPrice == null || !Number.isFinite(parsedPrice)) return parsedPrice ?? null;
  const price = Math.round(parsedPrice);
  const text = pageText || "";
  const installmentAmounts = amountsOnInstallmentLines(text);
  const looksLikeInstallmentPage = /할부\s*예상가|무이자\s*할부|월\s*[\d,]+원/.test(text);
  if (!looksLikeInstallmentPage && !installmentAmounts.has(price)) return price;

  const candidates = [...new Set(parseWonAmounts(text))].filter((n) => n > price);
  const match = candidates.find((total) => isNMonthInstallment(total, price));
  if (match) return match;
  if (installmentAmounts.has(price) && candidates.length > 0) {
    const nearby = candidates.find((total) => isNMonthInstallment(total, price));
    if (nearby) return nearby;
  }
  return price;
}
