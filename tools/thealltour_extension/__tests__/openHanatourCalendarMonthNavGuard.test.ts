import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type HanatourCalendarOpenApi = {
  findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
  findDateStripNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
  invalidateCalendarDomCache: (doc: Document) => void;
};

function loadOpenModule(): HanatourCalendarOpenApi {
  runInThisContext(readFileSync(path.join(extDir, "openHanatourCalendar.js"), "utf8"), {
    filename: "openHanatourCalendar.js",
  });
  const api = (globalThis as { HanatourCalendarOpen?: HanatourCalendarOpenApi })
    .HanatourCalendarOpen;
  if (!api?.findMonthNavButton) {
    throw new Error("HanatourCalendarOpen.findMonthNavButton was not exported");
  }
  return api;
}

/**
 * Reproduces the real "major-products" 2-tier calendar layout that caused the month
 * navigation bug: a month header ("2026년 8월") followed by a horizontal date strip
 * (17~31) that has its OWN "다음 날짜"/"이전 날짜" prev/next links, followed by the
 * REAL month prev/next links ("이전 달"/"다음 달"). Because the date strip's "다음
 * 날짜" link sits earlier in document order within the search scope than the real
 * "다음 달" link, the old blind-text pattern (which also matched "다음 날짜") picked
 * the wrong element and the month never advanced.
 */
function renderTwoTierCalendarFixture() {
  document.body.innerHTML = `
    <div class="calendar-wrap">
      <div class="cal_top"><em>2026년 8월</em></div>
      <div class="date_strip">
        <span class="weekday-row">월화수목금토일</span>
        <a class="prev" href="#none"><span class="blind">이전 날짜</span></a>
        <ul>
          ${Array.from({ length: 15 }, (_, i) => `<li>${17 + i}</li>`).join("")}
        </ul>
        <a class="next" href="#none"><span class="blind">다음 날짜</span></a>
      </div>
      <a class="month-prev" href="#none"><span class="blind">이전 달</span></a>
      <a class="month-next" href="#none"><span class="blind">다음 달</span></a>
    </div>
  `;
}

describe("findMonthNavButton vs findDateStripNavButton on a 2-tier calendar", () => {
  it("findMonthNavButton returns the real month-next link, not the date strip's next link", () => {
    const { findMonthNavButton, invalidateCalendarDomCache } = loadOpenModule();
    renderTwoTierCalendarFixture();
    invalidateCalendarDomCache(document);

    const btn = findMonthNavButton(document, "next");

    expect(btn).not.toBeNull();
    expect(btn?.className).toBe("month-next");
  });

  it("findMonthNavButton returns the real month-prev link, not the date strip's prev link", () => {
    const { findMonthNavButton, invalidateCalendarDomCache } = loadOpenModule();
    renderTwoTierCalendarFixture();
    invalidateCalendarDomCache(document);

    const btn = findMonthNavButton(document, "prev");

    expect(btn).not.toBeNull();
    expect(btn?.className).toBe("month-prev");
  });

  it("findDateStripNavButton still returns the date strip's own next link (unaffected by the guard)", () => {
    const { findDateStripNavButton, invalidateCalendarDomCache } = loadOpenModule();
    renderTwoTierCalendarFixture();
    invalidateCalendarDomCache(document);

    const btn = findDateStripNavButton(document, "next");

    expect(btn).not.toBeNull();
    expect(btn?.className).toBe("next");
    expect(btn?.closest(".date_strip")).not.toBeNull();
  });
});
