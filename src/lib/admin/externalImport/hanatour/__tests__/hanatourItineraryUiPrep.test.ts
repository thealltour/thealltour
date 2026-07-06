import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const DAY_TAB_REGEX = /^\s*(\d{1,2})\s*일차(?:\s|$)/;

function findDaySubTabsFromDoc(doc: Document) {
  const seen = new Set<number>();
  const out: { dayNumber: number }[] = [];
  doc.querySelectorAll('[role="tab"], button').forEach((el) => {
    const text = (el.textContent ?? "").trim();
    const m = text.match(DAY_TAB_REGEX);
    if (!m) return;
    const dayNumber = parseInt(m[1], 10);
    if (seen.has(dayNumber)) return;
    seen.add(dayNumber);
    out.push({ dayNumber });
  });
  return out.sort((a, b) => a.dayNumber - b.dayNumber);
}

describe("hanatourItineraryUiPrep fixtures", () => {
  it("finds 1일차~3일차 sub tabs", () => {
    const dom = new JSDOM(`<div role="tablist"><button role="tab">1일차</button><button role="tab">2일차</button><button role="tab">3일차</button></div>`);
    expect(findDaySubTabsFromDoc(dom.window.document).map((t) => t.dayNumber)).toEqual([1, 2, 3]);
  });

  it("matches day tab with date suffix", () => {
    const dom = new JSDOM(
      `<div role="tablist"><button role="tab">1일차 09/24(목)</button><button role="tab">2일차 09/25(금)</button></div>`,
    );
    expect(findDaySubTabsFromDoc(dom.window.document).map((t) => t.dayNumber)).toEqual([1, 2]);
  });
  it("resolves accordion panel via aria-controls", () => {
    const dom = new JSDOM(`<button aria-controls="day1-panel">1일차 09/24(목)</button><div id="day1-panel">Day one content with enough text to qualify as a panel.</div>`);
    const doc = dom.window.document;
    const controls = doc.querySelector("button")!.getAttribute("aria-controls");
    const panel = controls ? doc.getElementById(controls) : null;
    expect(panel?.id).toBe("day1-panel");
  });
});
