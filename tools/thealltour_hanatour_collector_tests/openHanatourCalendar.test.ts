import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type OpenApi = {
  findDayPriceStripContainer: (doc: Document) => Element | null;
  findAllPriceDayCellElements: (doc: Document) => Element[];
  findMonthHeaderElement: (doc: Document) => Element | null;
  findDateStripContainer: (doc: Document, header?: Element | null) => Element | null;
  getCurrentVisibleYearMonth: (doc: Document) => string | null;
  extractDayAndPriceFromCell: (el: Element) => { day: number; priceText: string } | null;
};

function loadOpenModule(): OpenApi {
  runInThisContext(readFileSync(path.join(extDir, "openHanatourCalendar.js"), "utf8"), {
    filename: "openHanatourCalendar.js",
  });
  const api = (globalThis as { HanatourCalendarOpen?: OpenApi }).HanatourCalendarOpen;
  if (!api) throw new Error("HanatourCalendarOpen was not exported");
  return api;
}

// 실제 버그 재현: "이전달/다음달"이 있는 오늘-날짜 기준 월간 그리드(가격 없음, widget A)와
// 실제 출발일별 가격을 보여주는 가로 스트립(widget B, 진짜 데이터)이 같은 문서에 함께
// 있을 때, 위젯 B(가격이 있는 진짜 위젯)를 정확히 찾아야 한다.
function renderTwoWidgetPage() {
  document.body.innerHTML = `
    <div class="ly_wrap">
      <button class="prev">이전달</button>
      <button class="next">다음달</button>
      <em>2026년 8월</em>
      <table>
        <tbody>
          <tr><td>일</td><td>월</td><td>화</td><td>수</td><td>목</td><td>금</td><td>토</td></tr>
          <tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr>
          <tr><td>8</td><td>9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td></tr>
        </tbody>
      </table>
    </div>
    <div class="dep-calendar-strip">
      <ul>
        <li><span class="num">16</span><span class="amt">164만</span></li>
        <li><span class="num">17</span><span class="amt">269만</span></li>
        <li><span class="num">18</span><span class="amt">194만</span></li>
        <li><span class="num">19</span><span class="amt">-</span></li>
        <li><span class="num">20</span><span class="amt">340만</span></li>
        <li><span class="num">21</span><span class="amt">214만</span></li>
      </ul>
    </div>
  `;
}

describe("openHanatourCalendar widget detection (cell-based)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // jsdom은 실제 레이아웃을 계산하지 않아 getBoundingClientRect가 항상 0을 반환한다.
    // isElementVisible()이 이를 "보이지 않음"으로 판단해버리므로, 테스트에서는 모든
    // 엘리먼트가 화면에 보이는 것으로 취급되도록 스텁을 심어준다.
    Element.prototype.getBoundingClientRect = function () {
      return { width: 20, height: 20, top: 0, left: 0, right: 20, bottom: 20, x: 0, y: 0, toJSON() {} };
    } as typeof Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds the real price strip (widget B), not the price-less month grid (widget A)", () => {
    renderTwoWidgetPage();
    const open = loadOpenModule();

    const cells = open.findAllPriceDayCellElements(document);
    // 가격이 있는 5개 셀만(19일은 '-'이므로 제외) 인식해야 한다.
    expect(cells.length).toBe(5);

    const container = open.findDayPriceStripContainer(document);
    expect(container).not.toBeNull();
    // 진짜 위젯(strip)의 <ul> (또는 그 상위)이어야 하고, 그리드(widget A)를 포함하면 안 된다.
    const strip = document.querySelector(".dep-calendar-strip ul")!;
    expect(container === strip || container!.contains(strip)).toBe(true);
    const gridTable = document.querySelector(".ly_wrap table")!;
    expect(container!.contains(gridTable)).toBe(false);
    expect((container!.className ?? "").toString()).not.toContain("ly_wrap");
  });

  it("does not report zero strip cells for describeCalendarDomState when two widgets exist", () => {
    renderTwoWidgetPage();
    const open = loadOpenModule() as OpenApi & {
      describeCalendarDomState: (doc: Document) => { stripCellCount: number; priceDayCellCount: number };
    };
    const state = open.describeCalendarDomState(document);
    expect(state.priceDayCellCount).toBe(5);
    expect(state.stripCellCount).toBeGreaterThan(0);
  });

  it("rolls the tracked year-month over when the day strip wraps from a high day back to a low day", async () => {
    document.body.innerHTML = `
      <div class="dep-calendar-strip">
        <div class="strip-row">
          <a class="prev">이전</a>
          <ul id="days">
            <li><span class="num">16</span><span class="amt">164만</span></li>
            <li><span class="num">20</span><span class="amt">340만</span></li>
            <li><span class="num">30</span><span class="amt">300만</span></li>
          </ul>
          <a class="next">다음</a>
        </div>
      </div>
    `;
    document.querySelector("a.next")!.addEventListener("click", () => {
      document.getElementById("days")!.innerHTML = `
        <li><span class="num">1</span><span class="amt">111만</span></li>
        <li><span class="num">5</span><span class="amt">150만</span></li>
      `;
    });

    const open = loadOpenModule() as OpenApi & {
      scrapeAllSearchHorizontalCalendarWithPaging: (
        doc: Document,
        options: { maxDateStripClicks?: number; anchorYearMonth?: string },
      ) => Promise<Record<string, unknown> | null>;
      getLastDateStripPagingMeta: () => { endYearMonth?: string } | null;
    };

    // jsdom/vitest에서 globalThis는 실제 Window 인스턴스가 아니라서, 프로덕션 코드가
    // `new MouseEvent("click", { view: globalThis })`를 호출하면 WebIDL 브랜드 체크에
    // 걸린다(실제 브라우저 확장 컨텍스트에서는 view가 진짜 window라 문제없음). 테스트
    // 환경에서만 느슨한 스텁으로 바꿔 클릭 디스패치 자체를 검증할 수 있게 한다.
    const OriginalMouseEvent = globalThis.MouseEvent;
    (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent = class extends Event {} as unknown as typeof Event;

    let result: Record<string, unknown> | null;
    try {
      result = await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
        maxDateStripClicks: 1,
        anchorYearMonth: "202608",
      });
    } finally {
      globalThis.MouseEvent = OriginalMouseEvent;
    }

    expect(result).not.toBeNull();
    expect(Object.keys(result!).sort()).toEqual(["202608", "202609"]);
    expect((result as Record<string, unknown[]>)["202608"]).toHaveLength(3);
    expect((result as Record<string, unknown[]>)["202609"]).toHaveLength(2);
    expect(open.getLastDateStripPagingMeta()?.endYearMonth).toBe("202609");
  });

  it("resets day strip from end position so next paging works on a new month step", async () => {
    document.body.innerHTML = `
      <div class="dep-calendar-strip">
        <div class="strip-row">
          <a class="prev">이전</a>
          <ul id="days">
            <li><span class="num">25</span><span class="amt">250만</span></li>
            <li><span class="num">28</span><span class="amt">280만</span></li>
            <li><span class="num">31</span><span class="amt">310만</span></li>
          </ul>
          <a class="next off">다음</a>
        </div>
      </div>
    `;

    document.querySelector("a.prev")!.addEventListener("click", () => {
      document.getElementById("days")!.innerHTML = `
        <li><span class="num">1</span><span class="amt">111만</span></li>
        <li><span class="num">5</span><span class="amt">150만</span></li>
        <li><span class="num">10</span><span class="amt">200만</span></li>
      `;
      document.querySelector("a.next")!.classList.remove("off");
    });

    document.querySelector("a.next")!.addEventListener("click", () => {
      document.getElementById("days")!.innerHTML = `
        <li><span class="num">11</span><span class="amt">210만</span></li>
        <li><span class="num">15</span><span class="amt">250만</span></li>
      `;
    });

    const open = loadOpenModule() as OpenApi & {
      resetDayStripToStart: (
        doc: Document,
        options?: { renderWaitMs?: number },
      ) => Promise<{ ok: boolean; prevClicks: number; minDay: number | null }>;
      scrapeAllSearchHorizontalCalendarWithPaging: (
        doc: Document,
        options: { maxDateStripClicks?: number; anchorYearMonth?: string },
      ) => Promise<Record<string, unknown> | null>;
      getLastDateStripPagingMeta: () => { clicks?: number; reason?: string } | null;
    };

    const OriginalMouseEvent = globalThis.MouseEvent;
    (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent = class extends Event {} as unknown as typeof Event;

    try {
      const reset = await open.resetDayStripToStart(document, { renderWaitMs: 500 });
      expect(reset.ok).toBe(true);
      expect(reset.prevClicks).toBeGreaterThan(0);
      expect(reset.minDay).toBeLessThanOrEqual(15);

      const result = await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
        maxDateStripClicks: 1,
        anchorYearMonth: "202609",
        prepareStrip: false,
      });

      expect(result).not.toBeNull();
      expect(open.getLastDateStripPagingMeta()?.clicks).toBe(1);
      expect(open.getLastDateStripPagingMeta()?.reason).toBeUndefined();
    } finally {
      globalThis.MouseEvent = OriginalMouseEvent;
    }
  });

  it("findDateStripNavButtonFresh re-resolves next button after strip DOM replacement", () => {
    document.body.innerHTML = `
      <div class="dep-calendar-strip">
        <div class="strip-row" id="strip-row">
          <a class="prev">이전</a>
          <ul id="days">
            <li><span class="num">20</span><span class="amt">200만</span></li>
            <li><span class="num">25</span><span class="amt">250만</span></li>
          </ul>
          <a class="next" id="legacy-next">다음</a>
        </div>
      </div>
    `;

    const open = loadOpenModule() as OpenApi & {
      findDateStripNavButtonFresh: (doc: Document, direction: "next" | "prev") => Element | null;
      invalidateCalendarDomCache: (doc: Document) => void;
    };

    const staleNext = document.getElementById("legacy-next");
    open.invalidateCalendarDomCache(document);
    expect(open.findDateStripNavButtonFresh(document, "next")).toBe(staleNext);

    document.getElementById("strip-row")!.innerHTML = `
      <a class="prev">이전</a>
      <ul id="days">
        <li><span class="num">1</span><span class="amt">111만</span></li>
        <li><span class="num">5</span><span class="amt">150만</span></li>
      </ul>
      <a class="btn_cal_next next">다음</a>
    `;

    expect(staleNext!.isConnected).toBe(false);
    open.invalidateCalendarDomCache(document);
    const freshNext = open.findDateStripNavButtonFresh(document, "next");
    expect(freshNext).not.toBeNull();
    expect(freshNext!.isConnected).toBe(true);
    expect(freshNext!.classList.contains("btn_cal_next")).toBe(true);
    expect(freshNext).not.toBe(staleNext);
  });

  it("finds .ly_wrap month nav buttons (다음달/이전달) on major-products grid", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="prev">이전달</button>
        <button class="next">다음달</button>
        <em>2026년 8월</em>
        <table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
      </div>
      <div class="dep-calendar-strip">
        <ul>
          <li><span class="num">16</span><span class="amt">164만</span></li>
        </ul>
      </div>
    `;

    const open = loadOpenModule() as OpenApi & {
      findLyWrapMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
      getLyWrapVisibleYearMonth: (doc: Document) => string | null;
    };

    expect(open.getLyWrapVisibleYearMonth(document)).toBe("202608");
    expect(open.findLyWrapMonthNavButton(document, "next")?.textContent).toMatch(/다음달/);
    expect(open.findLyWrapMonthNavButton(document, "prev")?.textContent).toMatch(/이전달/);
  });

  it("ignores price-like cells in footer/app banner outside calendar scope", () => {
    renderTwoWidgetPage();
    document.body.insertAdjacentHTML(
      "beforeend",
      `<footer><div><span class="num">99</span><span class="amt">999만</span></footer>`,
    );
    const open = loadOpenModule();
    const cells = open.findAllPriceDayCellElements(document);
    expect(cells.length).toBe(5);
    expect(cells.some((c) => (c.textContent ?? "").includes("999만"))).toBe(false);
  });
});
