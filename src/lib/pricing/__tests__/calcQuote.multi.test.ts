import { describe, expect, it } from "vitest";
import { calcQuote } from "@/lib/pricing/calcQuote";
import type { ProductOptions } from "@/types/product";

const multiOptions: ProductOptions = {
  basePrice: 899000,
  currency: "KRW",
  groups: [
    {
      key: "surcharges",
      title: "추가 옵션·할증",
      type: "multi",
      items: [
        { value: "surcharge-0", label: "싱글룸", priceDelta: 40000 },
        { value: "surcharge-1", label: "싱글카트", priceDelta: 18000 },
      ],
    },
  ],
};

describe("calcQuote multi groups", () => {
  it("returns base price when nothing selected", () => {
    const quote = calcQuote(multiOptions, {});
    expect(quote.total).toBe(899000);
    expect(quote.breakdown).toHaveLength(0);
  });

  it("adds one multi selection", () => {
    const quote = calcQuote(multiOptions, { surcharges: ["surcharge-0"] });
    expect(quote.total).toBe(939000);
    expect(quote.breakdown).toHaveLength(1);
    expect(quote.breakdown[0].optionLabel).toBe("싱글룸");
  });

  it("sums multiple multi selections", () => {
    const quote = calcQuote(multiOptions, {
      surcharges: ["surcharge-0", "surcharge-1"],
    });
    expect(quote.total).toBe(957000);
    expect(quote.breakdown).toHaveLength(2);
  });
});
