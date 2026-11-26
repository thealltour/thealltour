import { describe, expect, it } from "vitest";
import { calcQuote } from "@/lib/pricing/calcQuote";
import {
  findConsultOnlySelectedOptions,
  formatConsultOnlyOptionGuide,
  hasExplicitPayableKrwAmountText,
  isConsultOnlyProductOption,
  isForeignCurrencyOnlyPriceText,
  stripConsultOnlySelections,
} from "@/lib/products/optionCurrency";
import type { ProductOptions } from "@/types/product";

describe("isForeignCurrencyOnlyPriceText", () => {
  it("detects dollar-only and yuan-only texts", () => {
    expect(isForeignCurrencyOnlyPriceText("인/전일정/$240")).toBe(true);
    expect(isForeignCurrencyOnlyPriceText("18홀/120위안")).toBe(true);
    expect(isForeignCurrencyOnlyPriceText("¥120")).toBe(true);
    expect(isForeignCurrencyOnlyPriceText("CAD$55")).toBe(true);
    expect(isForeignCurrencyOnlyPriceText("AUD$80")).toBe(true);
  });

  it("keeps reference KRW conversion as foreign-only / consult-only", () => {
    expect(isForeignCurrencyOnlyPriceText("USD 240 (한화 약 33만원)")).toBe(true);
    expect(hasExplicitPayableKrwAmountText("USD 240 (한화 약 33만원)")).toBe(false);
  });

  it("returns false for explicit payable KRW (including 50위안(1만원))", () => {
    expect(isForeignCurrencyOnlyPriceText("50위안(1만원)")).toBe(false);
    expect(hasExplicitPayableKrwAmountText("50위안(1만원)")).toBe(true);
    expect(isForeignCurrencyOnlyPriceText("인/박/4만원")).toBe(false);
  });
});

describe("isConsultOnlyProductOption / formatConsultOnlyOptionGuide", () => {
  it("treats legacy Saipan-style option as consult-only even with bad priceDelta", () => {
    const item = {
      value: "surcharge-0",
      label: "싱글룸 이용시",
      meta: "인/전일정/$240",
      priceDelta: 240,
    };
    expect(isConsultOnlyProductOption(item)).toBe(true);
    expect(formatConsultOnlyOptionGuide(item)).toBe("1인·전일정 기준 USD 240 · 상담 문의");
  });

  it("treats USD + 한화 약 reference as consult-only even with stored priceDelta", () => {
    const item = {
      value: "surcharge-0",
      label: "싱글룸",
      meta: "USD 240 (한화 약 33만원)",
      priceDelta: 240,
    };
    expect(isConsultOnlyProductOption(item)).toBe(true);
    expect(formatConsultOnlyOptionGuide(item)).toBe("USD 240 · 상담 문의");
  });

  it("formats 인/3박/$240 guide", () => {
    expect(
      formatConsultOnlyOptionGuide({
        value: "x",
        label: "싱글룸",
        meta: "인/3박/$240",
      }),
    ).toBe("1인·3박 기준 USD 240 · 상담 문의");
  });

  it("prefers CAD/AUD codes over bare-dollar USD", () => {
    expect(
      formatConsultOnlyOptionGuide({
        value: "x",
        label: "싱글룸",
        meta: "CAD$55",
      }),
    ).toBe("CAD 55 · 상담 문의");
    expect(
      formatConsultOnlyOptionGuide({
        value: "x",
        label: "싱글카트",
        meta: "AUD$80",
      }),
    ).toBe("AUD 80 · 상담 문의");
  });
});

describe("legacy quote exclusion for reference conversion meta", () => {
  it("does not add 240원 when meta has USD + 한화 약 and priceDelta is 240", () => {
    const options: ProductOptions = {
      basePrice: 1_000_000,
      currency: "KRW",
      groups: [
        {
          key: "surcharges",
          title: "추가",
          type: "multi",
          items: [
            {
              value: "surcharge-0",
              label: "싱글룸",
              meta: "USD 240 (한화 약 33만원)",
              priceDelta: 240,
            },
          ],
        },
      ],
    };
    const quote = calcQuote(options, { surcharges: ["surcharge-0"] });
    expect(quote.total).toBe(1_000_000);
    expect(quote.breakdown).toHaveLength(0);
  });
});

describe("stripConsultOnlySelections", () => {
  const options: ProductOptions = {
    basePrice: 1000,
    currency: "KRW",
    groups: [
      {
        key: "surcharges",
        title: "추가",
        type: "multi",
        items: [
          { value: "surcharge-0", label: "싱글룸", meta: "인/전일정/$240", priceDelta: 240 },
          { value: "surcharge-1", label: "석식", meta: "인/식/1만원", priceDelta: 10000 },
        ],
      },
    ],
  };

  it("removes consult-only values and keeps KRW options", () => {
    expect(
      stripConsultOnlySelections(options, {
        surcharges: ["surcharge-0", "surcharge-1"],
      }),
    ).toEqual({ surcharges: ["surcharge-1"] });
  });

  it("finds consult-only selections for checkout errors", () => {
    expect(
      findConsultOnlySelectedOptions(options, { surcharges: ["surcharge-0"] }),
    ).toEqual([{ groupKey: "surcharges", itemValue: "surcharge-0", label: "싱글룸" }]);
  });
});
