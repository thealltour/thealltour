import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type SearchCalendar = Record<string, unknown[]> & {
  __fetchMetaExtensions?: Array<{ source: string; yearMonth?: string | null }>;
};

type HanatourCalendarBrowseApi = {
  browseHanatourCalendarMonths: (
    doc: Document,
    options?: { maxMonths?: number; deadline?: number },
  ) => Promise<SearchCalendar | null>;
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
 * Fake HanatourCalendarOpen + HanatourCalendarFilter surface. `readVisibleYearMonth`
 * (used by the new click-verify guard) delegates to
 * HanatourCalendarFilter.findVisibleYearMonthInDocument, so this fake tracks a
 * "currently visible month" index that only advances when `effectiveClicks` is true —
 * simulating the real bug where `nextBtn.click()` hit the wrong (date-strip) element
 * and the header never changed.
 */
function installFakeCalendarOpen(effectiveClicks: boolean) {
  const yearMonths = ["202608", "202609", "202610"];
  let visibleIndex = 0;
  const clickCalls: number[] = [];

  (globalThis as Record<string, unknown>).HanatourCalendarFilter = {
    findVisibleYearMonthInDocument: () => yearMonths[visibleIndex],
  };

  const nextBtn = {
    click: () => {
      clickCalls.push(visibleIndex);
      if (effectiveClicks) visibleIndex = Math.min(visibleIndex + 1, yearMonths.length - 1);
    },
  };

  (globalThis as Record<string, unknown>).HanatourCalendarOpen = {
    scrapeAllSearchHorizontalCalendarWithPaging: async () => ({
      [yearMonths[visibleIndex]]: [{ day: 1 }],
    }),
    getLastDateStripPagingMeta: () => null,
    getCalendarMonthKeys: (merged: SearchCalendar) =>
      Object.keys(merged).filter((k) => !k.startsWith("__")),
    hasMonthInCalendar: () => false,
    nextYearMonth: () => null,
    invalidateCalendarDomCache: () => {},
    findMonthNavButton: () => nextBtn,
  };

  return { clickCalls };
}

describe("browseHanatourCalendarMonths click-after-navigate verification guard", () => {
  it("collects all months normally when month-next clicks actually change the visible month", async () => {
    const { browseHanatourCalendarMonths } = loadBrowseModule();
    installFakeCalendarOpen(true);
    document.body.innerHTML = "<div></div>";

    const result = await browseHanatourCalendarMonths(document, {
      maxMonths: 3,
      deadline: Date.now() + 30_000,
    });

    expect(result).not.toBeNull();
    expect(Object.keys(result ?? {}).filter((k) => !k.startsWith("__"))).toHaveLength(3);
    const reasons = (result?.__fetchMetaExtensions ?? []).map((m) => m.source);
    expect(reasons).not.toContain("month_nav_click_ineffective");
  }, 10_000);

  it("stops after one month and records month_nav_click_ineffective when the click never changes the visible month (the reproduced bug)", async () => {
    const { browseHanatourCalendarMonths } = loadBrowseModule();
    installFakeCalendarOpen(false);
    document.body.innerHTML = "<div></div>";

    const result = await browseHanatourCalendarMonths(document, {
      maxMonths: 3,
      deadline: Date.now() + 30_000,
    });

    expect(result).not.toBeNull();
    expect(Object.keys(result ?? {}).filter((k) => !k.startsWith("__"))).toHaveLength(1);
    const ineffective = (result?.__fetchMetaExtensions ?? []).find(
      (m) => m.source === "month_nav_click_ineffective",
    );
    expect(ineffective).toBeTruthy();
    expect(ineffective?.yearMonth).toBe("202608");
  }, 10_000);
});
