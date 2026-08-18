import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type DateStripPagingMeta = {
  clicks: number;
  reason?: string | null;
} | null;

type HanatourCalendarOpenApi = {
  scrapeAllSearchHorizontalCalendarWithPaging: (
    doc: Document,
    options?: { tabId?: number | null; deadline?: number | null; maxDateStripClicks?: number },
  ) => Promise<Record<string, unknown[]> | null>;
  getLastDateStripPagingMeta: () => DateStripPagingMeta;
};

function loadOpenModule(): HanatourCalendarOpenApi {
  runInThisContext(readFileSync(path.join(extDir, "openHanatourCalendar.js"), "utf8"), {
    filename: "openHanatourCalendar.js",
  });
  const api = (globalThis as { HanatourCalendarOpen?: HanatourCalendarOpenApi })
    .HanatourCalendarOpen;
  if (!api?.scrapeAllSearchHorizontalCalendarWithPaging) {
    throw new Error(
      "HanatourCalendarOpen.scrapeAllSearchHorizontalCalendarWithPaging was not exported",
    );
  }
  return api;
}

describe("scrapeAllSearchHorizontalCalendarWithPaging deadline safety net", () => {
  it("stops on the very first iteration when the deadline has already passed", async () => {
    const { scrapeAllSearchHorizontalCalendarWithPaging, getLastDateStripPagingMeta } =
      loadOpenModule();
    document.body.innerHTML = "<div>2026년 9월</div>";

    const start = Date.now();
    const result = await scrapeAllSearchHorizontalCalendarWithPaging(document, {
      maxDateStripClicks: 40,
      deadline: Date.now() - 1000,
    });
    const elapsed = Date.now() - start;

    expect(result).toBeNull();
    expect(getLastDateStripPagingMeta()?.reason).toBe("deadline");
    expect(getLastDateStripPagingMeta()?.clicks).toBe(0);
    expect(elapsed).toBeLessThan(200);
  });

  it("behaves exactly as before when no deadline is passed (backward compatible)", async () => {
    const { scrapeAllSearchHorizontalCalendarWithPaging, getLastDateStripPagingMeta } =
      loadOpenModule();
    document.body.innerHTML = "<div>2026년 9월</div>";

    const result = await scrapeAllSearchHorizontalCalendarWithPaging(document, {
      maxDateStripClicks: 40,
    });

    expect(result).toBeNull();
    // No date-strip nav button exists in this bare fixture, so it should stop for that
    // reason (not "deadline") — proving the new deadline check never fires when omitted.
    expect(getLastDateStripPagingMeta()?.reason).not.toBe("deadline");
  });
});
