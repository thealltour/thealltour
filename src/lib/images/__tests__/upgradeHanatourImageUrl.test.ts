import { describe, expect, it } from "vitest";
import {
  isHanatourUiStockImageUrl,
  upgradeHanatourImageUrl,
} from "@/lib/images/upgradeHanatourImageUrl";

describe("upgradeHanatourImageUrl", () => {
  it("upgrades http hanatour CDN to https", () => {
    expect(upgradeHanatourImageUrl("http://image8.hanatour.com/schedule/caution_freeTime.jpg")).toBe(
      "https://image8.hanatour.com/schedule/caution_freeTime.jpg",
    );
  });

  it("leaves non-hanatour urls unchanged", () => {
    const url = "http://example.com/a.jpg";
    expect(upgradeHanatourImageUrl(url)).toBe(url);
  });
});

describe("isHanatourUiStockImageUrl", () => {
  it("flags schedule caution icons", () => {
    expect(
      isHanatourUiStockImageUrl("https://image8.hanatour.com/schedule/caution_freeTime.jpg"),
    ).toBe(true);
  });
});
