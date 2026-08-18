import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type SearchCalendar = Record<string, unknown[]>;

type HanatourCalendarBrowseApi = {
  DEFAULT_TOTAL_BUDGET_MS: number;
  browseHanatourCalendarMonths: (
    doc: Document,
    options?: {
      maxMonths?: number;
      tabId?: number | null;
      deadline?: number;
      totalBudgetMs?: number;
    },
  ) => Promise<(SearchCalendar & { __deadlineHit?: boolean }) | null>;
};

function loadBrowseModule(): HanatourCalendarBrowseApi {
  runInThisContext(readFileSync(path.join(extDir, "browseHanatourCalendarMonths.js"), "utf8"), {
    filename: "browseHanatourCalendarMonths.js",
  });
  const api = (globalThis as { HanatourCalendarBrowse?: HanatourCalendarBrowseApi })
    .HanatourCalendarBrowse;
  if (!api?.browseHanatourCalendarMonths) {
    throw new Error("HanatourCalendarBrowse.browseHanatourCalendarMonths was not exported");
  }
  return api;
}

/**
 * Minimal fake of the HanatourCalendarOpen surface used by browseHanatourCalendarMonths.
 * Each "month" contributes one day to the merged calendar and the fake month-nav button
 * click is tracked so tests can assert whether month navigation actually happened.
 */
function installFakeCalendarOpen(monthDayLabels: string[]) {
  let monthCallIndex = 0;
  const clickCalls: number[] = [];
  const nextBtn = { click: () => clickCalls.push(monthCallIndex) };

  (globalThis as Record<string, unknown>).HanatourCalendarOpen = {
    scrapeAllSearchHorizontalCalendarWithPaging: async () => {
      const label = monthDayLabels[Math.min(monthCallIndex, monthDayLabels.length - 1)];
      monthCallIndex += 1;
      return { [label]: [{ day: 1 }] };
    },
    getLastDateStripPagingMeta: () => null,
    getCalendarMonthKeys: (merged: SearchCalendar) => Object.keys(merged),
    hasMonthInCalendar: () => false,
    nextYearMonth: () => null,
    invalidateCalendarDomCache: () => {},
    findMonthNavButton: () => nextBtn,
  };

  return { clickCalls };
}

describe("browseHanatourCalendarMonths deadline safety net", () => {
  it("stops immediately without any month navigation when the deadline has already passed", async () => {
    const { browseHanatourCalendarMonths } = loadBrowseModule();
    const { clickCalls } = installFakeCalendarOpen(["2026-08", "2026-09", "2026-10"]);
    document.body.innerHTML = "<div></div>";

    const start = Date.now();
    const result = await browseHanatourCalendarMonths(document, {
      maxMonths: 12,
      deadline: Date.now() - 1000,
    });
    const elapsed = Date.now() - start;

    // A safety-net deadline that has already elapsed must short-circuit before doing
    // any real work (no month-nav clicks, no per-month calendar collection attempts).
    expect(clickCalls.length).toBe(0);
    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(200);
  });

  it("does not cut off a normal multi-month browse when the deadline is generous", async () => {
    const { browseHanatourCalendarMonths } = loadBrowseModule();
    const { clickCalls } = installFakeCalendarOpen(["2026-08", "2026-09", "2026-10"]);
    document.body.innerHTML = "<div></div>";

    const result = await browseHanatourCalendarMonths(document, {
      maxMonths: 3,
      deadline: Date.now() + 30_000,
    });

    // All 3 synthetic months should have been collected, proving the generous
    // safety-net deadline never interferes with a normal-length collection.
    expect(result).not.toBeNull();
    expect(Object.keys(result ?? {}).filter((k) => !k.startsWith("__"))).toHaveLength(3);
    expect(result?.__deadlineHit).toBeFalsy();
    expect(clickCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a multi-minute DEFAULT_TOTAL_BUDGET_MS when no deadline/budget is provided", () => {
    const { DEFAULT_TOTAL_BUDGET_MS } = loadBrowseModule();
    // Must be generous (minutes, not seconds) so near-daily-departure products spanning
    // several months are never truncated by this safety net.
    expect(DEFAULT_TOTAL_BUDGET_MS).toBeGreaterThanOrEqual(60_000);
  });
});
