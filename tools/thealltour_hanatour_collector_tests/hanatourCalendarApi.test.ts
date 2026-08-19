import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type CalendarApi = {
  mergeCalendarPayloads: (
    a: Record<string, unknown> | null,
    b: Record<string, unknown> | null,
  ) => {
    searchCalendar?: Record<string, Array<{ depDay: string }>>;
    calendarData?: unknown[];
    rprsProdCd?: string | null;
  } | null;
  countCalendarDays: (cal: Record<string, unknown[]> | null | undefined) => number;
};

function loadApi(): CalendarApi {
  runInThisContext(readFileSync(path.join(extDir, "hanatourCalendarApi.js"), "utf8"), {
    filename: "hanatourCalendarApi.js",
  });
  const api = (globalThis as { HanatourCalendarApi?: CalendarApi }).HanatourCalendarApi;
  if (!api) throw new Error("HanatourCalendarApi was not exported");
  return api;
}

describe("HanatourCalendarApi mergeCalendarPayloads", () => {
  it("merges searchCalendar months and calendarData rows", () => {
    const { mergeCalendarPayloads, countCalendarDays } = loadApi();
    const merged = mergeCalendarPayloads(
      {
        rprsProdCd: "MPA1114",
        searchCalendar: { "202608": [{ depDay: "20260801", adtAmt: "1000000" }] },
      },
      {
        searchCalendar: { "202609": [{ depDay: "20260915", adtAmt: "1100000" }] },
        calendarData: [{ depDay: "20260801", adtAmt: 1000000, arrDay: "20260804" }],
      },
    );
    expect(merged?.rprsProdCd).toBe("MPA1114");
    expect(countCalendarDays(merged?.searchCalendar)).toBe(2);
    expect(merged?.searchCalendar?.["202609"][0].depDay).toBe("20260915");
    expect(merged?.calendarData).toHaveLength(1);
  });
});
