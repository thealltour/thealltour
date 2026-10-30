import { describe, expect, it } from "vitest";

import { resolveAiraloCommerceSourceUrl } from "@/lib/affiliate/planner/providers/airalo/airaloKoreanUrl";

describe("resolveAiraloCommerceSourceUrl", () => {
  it("prefixes /ko/ on direct www.airalo.com product paths", () => {
    expect(resolveAiraloCommerceSourceUrl("https://www.airalo.com/japan-esim/moshi-moshi-7days-1gb")).toBe(
      "https://www.airalo.com/ko/japan-esim/moshi-moshi-7days-1gb",
    );
  });

  it("keeps an existing /ko/ prefix", () => {
    expect(resolveAiraloCommerceSourceUrl("https://www.airalo.com/ko/japan-esim/x")).toBe(
      "https://www.airalo.com/ko/japan-esim/x",
    );
  });

  it("rewrites pxf u= destination to Korean www.airalo.com", () => {
    const pxf =
      "https://airalo.pxf.io/c/1/2/3?u=" +
      encodeURIComponent("https://www.airalo.com/japan-esim/moshi-moshi-7days-1gb");
    expect(resolveAiraloCommerceSourceUrl(pxf)).toBe(
      "https://www.airalo.com/ko/japan-esim/moshi-moshi-7days-1gb",
    );
  });

  it("leaves unrelated hosts unchanged", () => {
    expect(resolveAiraloCommerceSourceUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});
