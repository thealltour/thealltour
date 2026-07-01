import { describe, expect, it } from "vitest";
import {
  getGroupSelectedValues,
  hasAnyOptionSelection,
  isGroupSelectionMissing,
  toggleMultiOption,
} from "@/lib/pricing/selectedOptions";
import type { ProductOptionGroup } from "@/types/product";

const multiGroup: ProductOptionGroup = {
  key: "surcharges",
  title: "추가 옵션·할증",
  type: "multi",
  items: [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ],
};

describe("selectedOptions helpers", () => {
  it("toggleMultiOption adds and removes values", () => {
    const first = toggleMultiOption("surcharges", "a", {});
    expect(getGroupSelectedValues(multiGroup, first)).toEqual(["a"]);

    const second = toggleMultiOption("surcharges", "b", first);
    expect(getGroupSelectedValues(multiGroup, second)).toEqual(["a", "b"]);

    const third = toggleMultiOption("surcharges", "a", second);
    expect(getGroupSelectedValues(multiGroup, third)).toEqual(["b"]);
  });

  it("isGroupSelectionMissing requires at least one value for required multi", () => {
    expect(isGroupSelectionMissing(multiGroup, {}, true)).toBe(true);
    expect(isGroupSelectionMissing(multiGroup, { surcharges: ["a"] }, true)).toBe(false);
  });

  it("hasAnyOptionSelection detects arrays", () => {
    expect(hasAnyOptionSelection({})).toBe(false);
    expect(hasAnyOptionSelection({ surcharges: [] })).toBe(false);
    expect(hasAnyOptionSelection({ surcharges: ["a"] })).toBe(true);
  });
});
