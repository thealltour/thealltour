import { describe, expect, it } from "vitest";
import {
  addProductOptionItem,
  parsePriceDeltaInput,
  parseProductOptionsJson,
  patchProductOptionItem,
  removeProductOptionItem,
  stringifyProductOptionsJson,
} from "@/lib/admin/productOptionsForm";

const imported = {
  basePrice: 799000,
  currency: "KRW" as const,
  groups: [
    {
      key: "surcharges",
      title: "추가 옵션·할증",
      type: "multi" as const,
      items: [
        {
          value: "surcharge-0",
          label: "싱글룸 이용시",
          priceDelta: 40000,
          meta: "인/박/4만원",
        },
        {
          value: "surcharge-1",
          label: "싱글카트 이용시",
          priceDelta: 18,
          meta: "18홀/120위안 추가",
        },
      ],
    },
  ],
};

describe("parseProductOptionsJson", () => {
  it("parses imported surcharge JSON", () => {
    const result = parseProductOptionsJson(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.options?.groups[0].items[0]).toMatchObject({
      label: "싱글룸 이용시",
      priceDelta: 40000,
      meta: "인/박/4만원",
    });
    expect(result.options?.groups[0].items[1]).toMatchObject({
      label: "싱글카트 이용시",
      priceDelta: 18,
      meta: "18홀/120위안 추가",
    });
  });

  it("returns null options for empty text", () => {
    expect(parseProductOptionsJson("")).toEqual({ ok: true, options: null });
  });

  it("returns an error for invalid JSON", () => {
    const result = parseProductOptionsJson("{not json");
    expect(result.ok).toBe(false);
  });
});

describe("stringifyProductOptionsJson", () => {
  it("omits cleared priceDelta", () => {
    const parsed = parseProductOptionsJson(JSON.stringify(imported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.options) return;
    const patched = patchProductOptionItem(parsed.options, 0, 1, { priceDelta: undefined });
    const json = stringifyProductOptionsJson(patched);
    const roundTrip = parseProductOptionsJson(json);
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;
    expect(roundTrip.options?.groups[0].items[1].priceDelta).toBeUndefined();
    expect(roundTrip.options?.groups[0].items[1].meta).toBe("18홀/120위안 추가");
  });

  it("returns empty string when no items remain", () => {
    const parsed = parseProductOptionsJson(JSON.stringify(imported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.options) return;
    const withoutFirst = removeProductOptionItem(parsed.options, 0, 0);
    expect(withoutFirst).not.toBeNull();
    const empty = removeProductOptionItem(withoutFirst!, 0, 0);
    expect(stringifyProductOptionsJson(empty)).toBe("");
  });
});

describe("addProductOptionItem", () => {
  it("creates a surcharges group when starting from empty", () => {
    const next = addProductOptionItem(null, 799000);
    expect(next.basePrice).toBe(799000);
    expect(next.groups[0].key).toBe("surcharges");
    expect(next.groups[0].items[0].value).toBe("surcharge-0");
  });
});

describe("parsePriceDeltaInput", () => {
  it("parses comma amounts and treats blank as empty", () => {
    expect(parsePriceDeltaInput("40,000")).toBe(40000);
    expect(parsePriceDeltaInput("")).toBeUndefined();
    expect(parsePriceDeltaInput("0")).toBeUndefined();
  });
});
