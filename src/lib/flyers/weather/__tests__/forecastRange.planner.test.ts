import { describe, expect, it } from "vitest";
import { computeForecastRequestRange } from "@/lib/flyers/weather/forecastRange";

describe("forecast range for planner too_early", () => {
  it("rejects past end dates", () => {
    const r = computeForecastRequestRange("2020-01-01", "2020-01-05");
    expect(r.ok).toBe(false);
  });

  it("accepts near-term ranges within horizon", () => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    const start = `${y}-${m}-${d}`;
    const endDate = new Date(Date.UTC(y, today.getUTCMonth(), today.getUTCDate() + 3));
    const end = endDate.toISOString().slice(0, 10);
    const r = computeForecastRequestRange(start, end);
    expect(r.ok).toBe(true);
  });
});
