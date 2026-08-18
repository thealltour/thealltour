import { describe, expect, it } from "vitest";
import { normalizeThemeChartForInsert } from "@/lib/admin/themeChartSchema";

describe("normalizeThemeChartForInsert", () => {
  it("returns null for fewer than 2 valid items", () => {
    expect(normalizeThemeChartForInsert(null)).toBeNull();
    expect(normalizeThemeChartForInsert({ items: [] })).toBeNull();
    expect(
      normalizeThemeChartForInsert({ items: [{ label: "골프", percent: 100 }] }),
    ).toBeNull();
    expect(
      normalizeThemeChartForInsert({
        items: [
          { label: "  ", percent: 40 },
          { label: "관광", percent: 60 },
        ],
      }),
    ).toBeNull();
  });

  it("drops empty labels and keeps remaining items", () => {
    const result = normalizeThemeChartForInsert({
      items: [
        { label: "", percent: 10 },
        { label: "골프", percent: 60 },
        { label: "관광", percent: 40 },
      ],
    });
    expect(result).toEqual({
      items: [
        { label: "골프", percent: 60 },
        { label: "관광", percent: 40 },
      ],
    });
  });

  it("renormalizes percents that do not sum to 100", () => {
    const result = normalizeThemeChartForInsert({
      items: [
        { label: "골프", percent: 2 },
        { label: "관광", percent: 1 },
        { label: "식사", percent: 1 },
      ],
    });
    expect(result).toEqual({
      items: [
        { label: "골프", percent: 50 },
        { label: "관광", percent: 25 },
        { label: "식사", percent: 25 },
      ],
    });
    expect(result?.items.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
  });

  it("accepts a raw array of items", () => {
    const result = normalizeThemeChartForInsert([
      { label: "골프", percent: 70 },
      { label: "관광", percent: 30 },
    ]);
    expect(result).toEqual({
      items: [
        { label: "골프", percent: 70 },
        { label: "관광", percent: 30 },
      ],
    });
  });
});
