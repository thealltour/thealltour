import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

function loadModules() {
  runInThisContext(readFileSync(path.join(extDir, "openHanatourCalendar.js"), "utf8"), {
    filename: "openHanatourCalendar.js",
  });
  runInThisContext(readFileSync(path.join(extDir, "browseHanatourCalendarMonths.js"), "utf8"), {
    filename: "browseHanatourCalendarMonths.js",
  });
  const open = (globalThis as { HanatourCalendarOpen?: Record<string, unknown> }).HanatourCalendarOpen;
  const browse = (
    globalThis as {
      HanatourCalendarBrowse?: {
        browseHanatourCalendarMonths: (
          doc: Document,
          options?: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      };
    }
  ).HanatourCalendarBrowse;
  if (!open || !browse?.browseHanatourCalendarMonths) {
    throw new Error("modules not exported");
  }
  return { open, browse };
}

describe("browseHanatourCalendarMonths fake-month guard (0.4.24)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Element.prototype.getBoundingClientRect = function () {
      return { width: 20, height: 20, top: 0, left: 0, right: 20, bottom: 20, x: 0, y: 0, toJSON() {} };
    } as typeof Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it(
    "does not fabricate extra months when month click leaves price strip unchanged",
    async () => {
      document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="prev">이전달</button>
        <button class="next" id="ly-next">다음달</button>
        <em id="ly-label">2027년 7월</em>
        <table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
      </div>
      <div class="calendar_wrap dep-calendar-strip">
        <div class="calendar_header">
          <button class="btn_prev">이전달</button>
          <em>2026년 8월</em>
          <button class="btn_next" id="strip-month-next">다음달</button>
        </div>
        <ul id="days">
          <li><span class="num">1</span><span class="amt">111만</span></li>
          <li><span class="num">5</span><span class="amt">150만</span></li>
          <li><span class="num">10</span><span class="amt">200만</span></li>
        </ul>
      </div>
    `;

      document.getElementById("strip-month-next")!.addEventListener("click", () => {
        /* no price strip change */
      });

      const { browse } = loadModules();
      const OriginalMouseEvent = globalThis.MouseEvent;
      (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent =
        class extends Event {} as unknown as typeof Event;

      let result: Record<string, unknown>;
      try {
        result = await browse.browseHanatourCalendarMonths(document, {
          maxMonths: 12,
          startYearMonth: "202608",
          totalBudgetMs: 20_000,
          monthNavPostClickMs: 20,
          monthNavSettleMs: 5,
          priceSignatureWaitMs: 80,
          monthHeaderAdvanceWaitMs: 80,
        });
      } finally {
        globalThis.MouseEvent = OriginalMouseEvent;
      }

      const monthKeys = Object.keys(result)
        .filter((k) => /^\d{6}$/.test(k))
        .sort();
      expect(monthKeys.length).toBeLessThanOrEqual(2);
      expect(monthKeys[0]).toBe("202608");
      const meta = (result.__fetchMetaExtensions as Array<{ source?: string }>) ?? [];
      expect(meta.some((m) => m.source === "price_signature_unchanged_after_month_nav")).toBe(true);
    },
    15_000,
  );
});
