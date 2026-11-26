import { describe, expect, it } from "vitest";
import {
  findConsultOnlySelectedOptions,
  formatConsultOnlyOptionGuide,
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
  });

  it("returns false when KRW is also present", () => {
    expect(isForeignCurrencyOnlyPriceText("50위안(1만원)")).toBe(false);
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

  it("formats 인/3박/$240 guide", () => {
    expect(
      formatConsultOnlyOptionGuide({
        value: "x",
        label: "싱글룸",
        meta: "인/3박/$240",
      }),
    ).toBe("1인·3박 기준 USD 240 · 상담 문의");
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
