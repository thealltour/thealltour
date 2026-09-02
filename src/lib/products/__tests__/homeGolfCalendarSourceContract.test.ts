import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/lib/products/getGolfDepartureCalendarProducts.ts"),
  "utf8",
);

describe("Home Golf calendar slim fetch contract", () => {
  it("uses getHomeGolfDepartureCalendarEventSources instead of getProducts", () => {
    expect(SOURCE).toContain("getHomeGolfDepartureCalendarEventSources");
    expect(SOURCE).not.toMatch(/import\s*\{[^}]*\bgetProducts\b/);
    expect(SOURCE).not.toMatch(/await getProducts\(/);
  });

  it("uses GOLF_CALENDAR_PRODUCT_SELECT without select(*)", () => {
    expect(SOURCE).toContain("GOLF_CALENDAR_PRODUCT_SELECT");
    expect(SOURCE).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    expect(SOURCE).not.toMatch(/\bnormalizeProduct\s*\(/);
  });

  it("uses chunked range fetch", () => {
    expect(SOURCE).toContain("HOME_GOLF_CALENDAR_CHUNK_SIZE");
    expect(SOURCE).toContain(".range(");
  });

  it("uses buildGolfOrFilter for golf channel DB predicate", () => {
    expect(SOURCE).toContain("buildGolfOrFilter");
    expect(SOURCE).toContain("buildHomeGolfChannelDbFilter");
  });
});
