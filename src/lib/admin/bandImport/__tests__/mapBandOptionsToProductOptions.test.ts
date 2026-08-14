import { describe, expect, it } from "vitest";
import {
  mapBandOptionsToProductOptions,
  parseKrwDeltaFromPriceText,
} from "@/lib/admin/bandImport/mapBandOptionsToProductOptions";

describe("parseKrwDeltaFromPriceText", () => {
  it("parses 만원 notation", () => {
    expect(parseKrwDeltaFromPriceText("인/박/4만원")).toBe(40000);
  });

  it("parses won notation", () => {
    expect(parseKrwDeltaFromPriceText("추가 20,000원")).toBe(20000);
  });

  it("parses 만원 even when a hole count appears first", () => {
    expect(parseKrwDeltaFromPriceText("인/18홀/주중/2만원")).toBe(20000);
  });

  it("does not treat hole counts or yuan as KRW", () => {
    expect(parseKrwDeltaFromPriceText("18홀/120위안 추가")).toBeNull();
    expect(parseKrwDeltaFromPriceText("싱글카트 이용 시 (18홀/120위안)추가됩니다")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseKrwDeltaFromPriceText("특정일 문의")).toBeNull();
  });
});

describe("mapBandOptionsToProductOptions", () => {
  it("maps surcharge options to ProductOptions groups", () => {
    const result = mapBandOptionsToProductOptions(
      [
        { name: "싱글룸 이용 추가", priceText: "인/박/4만원" },
        { name: "싱글카트 이용", priceText: "인/18홀/주중/2만원" },
      ],
      890000,
    );

    expect(result?.basePrice).toBe(890000);
    expect(result?.currency).toBe("KRW");
    expect(result?.groups).toHaveLength(1);
    expect(result?.groups[0].key).toBe("surcharges");
    expect(result?.groups[0].items).toHaveLength(2);
    expect(result?.groups[0].items[0]).toMatchObject({
      label: "싱글룸 이용 추가",
      meta: "인/박/4만원",
      priceDelta: 40000,
    });
    expect(result?.groups[0].items[1]).toMatchObject({
      label: "싱글카트 이용",
      meta: "인/18홀/주중/2만원",
      priceDelta: 20000,
    });
  });

  it("keeps yuan surcharge text as meta without a KRW delta", () => {
    const result = mapBandOptionsToProductOptions(
      [{ name: "싱글카트 이용시", priceText: "18홀/120위안 추가" }],
      799000,
    );
    expect(result?.groups[0].items[0]).toEqual({
      value: "surcharge-0",
      label: "싱글카트 이용시",
      meta: "18홀/120위안 추가",
    });
    expect(result?.groups[0].items[0].priceDelta).toBeUndefined();
  });

  it("returns null for empty options", () => {
    expect(mapBandOptionsToProductOptions([], 100000)).toBeNull();
    expect(mapBandOptionsToProductOptions(null, 100000)).toBeNull();
  });
});
