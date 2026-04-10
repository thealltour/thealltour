import { describe, expect, it } from "vitest";
import { buildWeatherCacheKey, normalizeCityForWeatherCache } from "../buildWeatherCacheKey";

describe("buildWeatherCacheKey", () => {
  it("normalizes city and builds v1 key", () => {
    expect(normalizeCityForWeatherCache("Chiang Mai")).toBe("chiang-mai");
    expect(buildWeatherCacheKey("Chiang Mai", "2026-04-17", "2026-04-21")).toBe(
      "weather:chiang-mai:2026-04-17:2026-04-21:v1",
    );
  });

  it("trims city and collapses whitespace to hyphens", () => {
    expect(buildWeatherCacheKey("  Bangkok  ", "2026-01-01", "2026-01-05")).toBe(
      "weather:bangkok:2026-01-01:2026-01-05:v1",
    );
    expect(buildWeatherCacheKey("New  York", "2026-01-01", "2026-01-05")).toBe(
      "weather:new-york:2026-01-01:2026-01-05:v1",
    );
  });
});
