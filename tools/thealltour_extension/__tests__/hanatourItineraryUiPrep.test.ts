import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type DayTab = { dayNumber: number; el: Element };

type HanatourItineraryUiPrepApi = {
  ownLabel: (el: Element | null, max?: number) => string;
  isProductUiClick: (el: Element | null) => boolean;
  isSafeClickTarget: (el: Element | null) => boolean;
  findDaySubTabs: (doc: Document) => DayTab[];
};

function loadUiPrep(): HanatourItineraryUiPrepApi {
  const existing = (globalThis as { HanatourItineraryUiPrep?: HanatourItineraryUiPrepApi })
    .HanatourItineraryUiPrep;
  if (existing?.ownLabel) return existing;
  runInThisContext(readFileSync(path.join(extDir, "hanatourItineraryUiPrep.js"), "utf8"), {
    filename: "hanatourItineraryUiPrep.js",
  });
  const api = (globalThis as { HanatourItineraryUiPrep?: HanatourItineraryUiPrepApi })
    .HanatourItineraryUiPrep;
  if (!api?.ownLabel) {
    throw new Error("HanatourItineraryUiPrep.ownLabel was not exported");
  }
  return api;
}

describe("hanatourItineraryUiPrep click guard for day navigation", () => {
  it("treats 다음일차/이전일차 buttons as safe product-ui clicks even inside a <nav> wrapper", () => {
    const { isProductUiClick, isSafeClickTarget } = loadUiPrep();
    document.body.innerHTML = `
      <main>
        <div role="tabpanel">
          <p>여행일정 탭입니다. 1일차부터 6일차까지 상세 일정을 확인하세요.</p>
          <nav class="day-tab-nav" aria-label="일차 이동">
            <button class="next-day-btn">다음일차</button>
            <button class="prev-day-btn">이전일차</button>
          </nav>
        </div>
      </main>
    `;
    const nextBtn = document.querySelector(".next-day-btn");
    const prevBtn = document.querySelector(".prev-day-btn");

    expect(isProductUiClick(nextBtn)).toBe(true);
    expect(isProductUiClick(prevBtn)).toBe(true);
    // isSafeClickTarget must short-circuit true via isProductUiClick, bypassing the
    // bare <nav> ancestor chrome check that previously blocked this button.
    expect(isSafeClickTarget(nextBtn)).toBe(true);
    expect(isSafeClickTarget(prevBtn)).toBe(true);
  });
});

describe("hanatourItineraryUiPrep ownLabel fallback", () => {
  it("falls back to full element text for day tabs with several child spans (icon+date+label+badge)", () => {
    const { ownLabel } = loadUiPrep();
    const el = document.createElement("li");
    el.innerHTML = `<span class="label">3일차</span><span class="date">09/26(토)</span><span class="city">시드니</span><span class="badge">NEW</span><span class="icon"></span>`;

    expect(el.childElementCount).toBeGreaterThan(4);
    expect(ownLabel(el, 40)).toContain("3일차");
  });
});

describe("hanatourItineraryUiPrep findDaySubTabs beyond day 2", () => {
  it("recognizes day tabs 1-3 even when day 3's label has multiple child spans", () => {
    const { findDaySubTabs } = loadUiPrep();
    document.body.innerHTML = `
      <main>
        <div role="tabpanel">
          <p>여행일정: 1일차부터 6일차까지 상세 일정을 만나보세요. 이 상품의 전체 일정 안내입니다.</p>
          <ul role="tablist">
            <li role="tab">1일차</li>
            <li role="tab">2일차</li>
            <li role="tab"><span class="label">3일차</span><span class="date">09/26(토)</span><span class="city">시드니</span><span class="badge">NEW</span><span class="icon"></span></li>
          </ul>
        </div>
      </main>
    `;
    const tabs = findDaySubTabs(document);
    expect(tabs.map((t) => t.dayNumber)).toEqual([1, 2, 3]);
  });
});
