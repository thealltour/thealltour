import { describe, expect, it } from "vitest";
import { buildDisabledMatcher, dateToYmd, ymdToDate } from "@/lib/datePickerUtils";

describe("datePickerUtils", () => {
  it("round-trips valid YMD strings", () => {
    const date = ymdToDate("2026-06-12");
    expect(date).toBeDefined();
    expect(dateToYmd(date!)).toBe("2026-06-12");
  });

  it("rejects invalid YMD strings", () => {
    expect(ymdToDate("")).toBeUndefined();
    expect(ymdToDate("2026-13-01")).toBeUndefined();
    expect(ymdToDate("not-a-date")).toBeUndefined();
  });

  it("builds disabled matcher from min and max", () => {
    const matcher = buildDisabledMatcher("2026-06-01", "2026-06-30");
    expect(Array.isArray(matcher)).toBe(true);
    expect(matcher).toHaveLength(2);
  });
});
