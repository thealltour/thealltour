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
        dateStripPostClickMs: 50,
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
      const reset = await open.resetDayStripToStart(document, {
        renderWaitMs: 500,
        dateStripPostClickMs: 50,
      });
      expect(reset.ok).toBe(true);
      expect(reset.prevClicks).toBeGreaterThan(0);
      expect(reset.minDay).toBeLessThanOrEqual(15);

      const result = await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
        maxDateStripClicks: 1,
        anchorYearMonth: "202609",
        prepareStrip: false,
        dateStripPostClickMs: 50,
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

  it("promotes leaf LI NCA to parent UL for day price strip container", () => {
    document.body.innerHTML = `
      <div class="dep-calendar-strip">
        <ul id="price-ul">
          <li id="cell-a"><span class="num">10</span><span class="amt">100만</span></li>
          <li id="cell-b"><span class="num">11</span><span class="amt">110만</span></li>
          <li id="cell-c"><span class="num">12</span><span class="amt">120만</span></li>
        </ul>
      </div>
    `;
    const open = loadOpenModule();
    const container = open.findDayPriceStripContainer(document);
    expect(container).not.toBeNull();
    expect(container!.tagName).not.toBe("LI");
    const ul = document.getElementById("price-ul")!;
    expect(container === ul || container!.contains(ul) || ul.contains(container!)).toBe(true);
  });

  it("prefers month next near price strip over ly_wrap widget A", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="prev">이전달</button>
        <button class="next" id="ly-next">다음달</button>
        <em>2027년 7월</em>
        <table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
      </div>
      <div class="calendar_wrap dep-calendar-strip">
        <div class="calendar_header">
          <button class="btn_prev">이전달</button>
          <em>2026년 8월</em>
          <button class="btn_next" id="strip-month-next">다음달</button>
        </div>
        <ul>
          <li><span class="num">16</span><span class="amt">164만</span></li>
          <li><span class="num">17</span><span class="amt">269만</span></li>
          <li><span class="num">18</span><span class="amt">194만</span></li>
        </ul>
        <a class="next" id="strip-day-next"><span class="blind">다음 날짜</span></a>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
    };
    const btn = open.findMonthNavButton(document, "next");
    expect(btn).not.toBeNull();
    expect(btn!.id).toBe("strip-month-next");
    expect(btn!.id).not.toBe("ly-next");
  });

  it("invalidates DOM cache while waiting for date-strip paging advance", async () => {
    document.body.innerHTML = `
      <div class="dep-calendar-strip">
        <div class="strip-row">
          <a class="prev">이전</a>
          <ul id="days">
            <li><span class="num">1</span><span class="amt">111만</span></li>
            <li><span class="num">5</span><span class="amt">150만</span></li>
            <li><span class="num">10</span><span class="amt">200만</span></li>
          </ul>
          <a class="next" id="day-next">다음</a>
        </div>
      </div>
    `;
    let clickCount = 0;
    document.getElementById("day-next")!.addEventListener("click", () => {
      clickCount += 1;
      document.getElementById("days")!.innerHTML = `
        <li><span class="num">11</span><span class="amt">210만</span></li>
        <li><span class="num">15</span><span class="amt">250만</span></li>
        <li><span class="num">20</span><span class="amt">300만</span></li>
      `;
    });

    const open = loadOpenModule() as OpenApi & {
      scrapeAllSearchHorizontalCalendarWithPaging: (
        doc: Document,
        options: {
          maxDateStripClicks?: number;
          anchorYearMonth?: string;
          dateStripPostClickMs?: number;
        },
      ) => Promise<Record<string, unknown> | null>;
      getLastDateStripPagingMeta: () => { clicks?: number; reason?: string } | null;
      DEFAULT_MAX_DATE_STRIP_CLICKS: number;
    };

    expect(open.DEFAULT_MAX_DATE_STRIP_CLICKS).toBe(3);

    const OriginalMouseEvent = globalThis.MouseEvent;
    (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent = class extends Event {} as unknown as typeof Event;
    try {
      const result = await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
        maxDateStripClicks: 1,
        anchorYearMonth: "202608",
        dateStripPostClickMs: 20,
      });
      expect(result).not.toBeNull();
      expect(clickCount).toBeGreaterThanOrEqual(1);
      expect((open.getLastDateStripPagingMeta()?.clicks ?? 0) >= 1 || Object.keys(result!).length >= 1).toBe(
        true,
      );
    } finally {
      globalThis.MouseEvent = OriginalMouseEvent;
    }
  });


  it("picks calendar_wrap inside ly_wrap prod_list ul.type, not the whole ul.type list", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <em>2026년 8월</em>
        <div class="prod_list_wrap">
          <ul class="type">
            <li>판매상품보기 패키지 스페인/포르투갈 9~11일 #베스트셀러</li>
            <li>
              <span>4,099,000원~</span>
              <div class="sub_list_wrap">
                <div class="calendar_wrap">
                  <div class="header">
                    <a class="prev"><span class="blind">이전달</span></a>
                    <strong>2026년 9월</strong>
                    <a href="#none" class="next" id="mes-month-next"><span class="blind">다음달</span></a>
                  </div>
                  <div class="calendar_area">
                    <a class="prev"><span class="blind">이전 날짜</span></a>
                    <ul>
                      <li><span class="num">1</span><span class="amt">641만</span></li>
                      <li><span class="num">4</span><span class="amt">659만</span></li>
                      <li><span class="num">5</span><span class="amt">444만</span></li>
                    </ul>
                    <a href="#none" class="next" id="mes-day-next"><span class="blind">다음 날짜</span></a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      findDateStripNavButtonFresh: (doc: Document, direction: "next" | "prev") => Element | null;
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
      getCurrentVisibleYearMonth: (doc: Document) => string | null;
    };
    const container = open.findDayPriceStripContainer(document);
    expect(container).not.toBeNull();
    expect(container?.tagName?.toUpperCase()).not.toBe("UL");
    expect(container?.className).toContain("calendar_area");
    expect(container?.className).not.toMatch(/\btype\b/);
    expect(open.getCurrentVisibleYearMonth(document)).toBe("202609");
    expect(open.findMonthNavButton(document, "next")?.id).toBe("mes-month-next");
    expect(open.findDateStripNavButtonFresh(document, "next")?.id).toBe("mes-day-next");
  });

  it("does not treat ly_wrap calendar_area 다음 날짜 as month pager (0.4.28)", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="next" id="ly-filter-next">다음달</button>
        <em>2026년 8월</em>
        <div class="prod_list_wrap">
          <ul class="type">
            <li>
              <div class="sub_list_wrap">
                <div class="calendar_wrap">
                  <div class="header">
                    <a class="next" id="mes-month-next"><span class="blind">다음달</span></a>
                    <strong>2026년 9월</strong>
                  </div>
                  <div class="calendar_area">
                    <ul id="days">
                      <li><span class="num">1</span><span class="amt">100만</span></li>
                      <li><span class="num">5</span><span class="amt">110만</span></li>
                      <li><span class="num">10</span><span class="amt">120만</span></li>
                    </ul>
                    <a href="#none" class="next" id="mes-day-next"><span class="blind">다음 날짜</span></a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      isMonthPagerNavElement: (el: Element) => boolean;
      findDateStripNavButtonFresh: (doc: Document, direction: "next" | "prev") => Element | null;
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
      scrapeAllSearchHorizontalCalendarWithPaging: (
        doc: Document,
        options: Record<string, unknown>,
      ) => Promise<Record<string, unknown> | null>;
      getLastDateStripPagingMeta: () => { clicks?: number; reason?: string; via?: string } | null;
      DEFAULT_MAX_DATE_STRIP_CLICKS: number;
    };

    expect(open.DEFAULT_MAX_DATE_STRIP_CLICKS).toBe(3);
    expect(open.isMonthPagerNavElement(document.getElementById("ly-filter-next")!)).toBe(true);
    expect(open.isMonthPagerNavElement(document.getElementById("mes-month-next")!)).toBe(true);
    expect(open.isMonthPagerNavElement(document.getElementById("mes-day-next")!)).toBe(false);
    expect(open.findDateStripNavButtonFresh(document, "next")?.id).toBe("mes-day-next");
    expect(open.findMonthNavButton(document, "next")?.id).toBe("mes-month-next");

    let dayClicks = 0;
    document.getElementById("mes-day-next")!.addEventListener("click", () => {
      dayClicks += 1;
      const ul = document.getElementById("days")!;
      const base = dayClicks * 5;
      ul.innerHTML = `
        <li><span class="num">${base + 1}</span><span class="amt">${100 + base}만</span></li>
        <li><span class="num">${base + 5}</span><span class="amt">${110 + base}만</span></li>
        <li><span class="num">${base + 10}</span><span class="amt">${120 + base}만</span></li>
      `;
    });

    const OriginalMouseEvent = globalThis.MouseEvent;
    (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent =
      class extends Event {} as unknown as typeof Event;
    return (async () => {
      try {
        await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
          maxDateStripClicks: 3,
          anchorYearMonth: "202609",
          prepareStrip: false,
          dateStripPostClickMs: 5,
          stripRenderWaitMs: 5,
        });
        const meta = open.getLastDateStripPagingMeta();
        expect(meta?.reason).not.toBe("month_pager");
        expect(meta?.clicks ?? 0).toBeGreaterThanOrEqual(1);
        expect(dayClicks).toBeGreaterThanOrEqual(1);
      } finally {
        globalThis.MouseEvent = OriginalMouseEvent;
      }
    })();
  });

  it("picks calendar_wrap .header 다음달 for month and calendar_area 다음 날짜 for day strip", () => {
    document.body.innerHTML = `
      <div class="calendar_wrap">
        <div class="header">
          <a class="prev"><span class="blind">이전달</span></a>
          <strong>2026년 9월</strong>
          <a href="#none" class="next" id="mes-month-next"><span class="blind">다음달</span></a>
        </div>
        <div class="calendar_area">
          <a class="prev"><span class="blind">이전 날짜</span></a>
          <ul>
            <li><span class="num">1</span><span class="amt">641만</span></li>
            <li><span class="num">4</span><span class="amt">659만</span></li>
          </ul>
          <a href="#none" class="next" id="mes-day-next"><span class="blind">다음 날짜</span></a>
        </div>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      findDateStripNavButtonFresh: (doc: Document, direction: "next" | "prev") => Element | null;
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
      getCurrentVisibleYearMonth: (doc: Document) => string | null;
    };
    expect(open.getCurrentVisibleYearMonth(document)).toBe("202609");
    expect(open.findMonthNavButton(document, "next")?.id).toBe("mes-month-next");
    expect(open.findDateStripNavButtonFresh(document, "next")?.id).toBe("mes-day-next");
  });

  it("picks day-strip 다음 날짜 over calendar_header 다음달 (a.next that jumps 3 months)", () => {
    document.body.innerHTML = `
      <div class="calendar_wrap dep-calendar-strip">
        <div class="calendar_header">
          <button class="btn_prev">이전달</button>
          <em>2026년 8월</em>
          <a class="next" id="month-next"><span class="blind">다음달</span></a>
        </div>
        <div class="strip-row">
          <a class="prev" id="day-prev"><span class="blind">이전 날짜</span></a>
          <ul>
            <li><span class="num">16</span><span class="amt">164만</span></li>
            <li><span class="num">17</span><span class="amt">269만</span></li>
            <li><span class="num">18</span><span class="amt">194만</span></li>
          </ul>
          <a class="next" id="day-next"><span class="blind">다음 날짜</span></a>
        </div>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      findDateStripNavButtonFresh: (doc: Document, direction: "next" | "prev") => Element | null;
      isMonthPagerNavElement: (el: Element) => boolean;
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
    };
    expect(open.isMonthPagerNavElement(document.getElementById("month-next")!)).toBe(true);
    expect(open.isMonthPagerNavElement(document.getElementById("day-next")!)).toBe(false);
    expect(open.findDateStripNavButtonFresh(document, "next")?.id).toBe("day-next");
    expect(open.findDateStripNavButtonFresh(document, "prev")?.id).toBe("day-prev");
    expect(open.findMonthNavButton(document, "next")?.id).toBe("month-next");
  });

  it("yearMonthDelta reports a 3-month jump", () => {
    const open = loadOpenModule() as OpenApi & {
      yearMonthDelta: (fromYm: string, toYm: string) => number | null;
    };
    expect(open.yearMonthDelta("202608", "202611")).toBe(3);
    expect(open.yearMonthDelta("202611", "202608")).toBe(-3);
  });

  it("stops date-strip paging when a next click jumps the month header by 3 months", async () => {
    document.body.innerHTML = `
      <div class="calendar_wrap dep-calendar-strip">
        <div class="calendar_header"><em id="ym">2026년 8월</em></div>
        <div class="strip-row">
          <ul id="days">
            <li><span class="num">1</span><span class="amt">111만</span></li>
            <li><span class="num">5</span><span class="amt">150만</span></li>
          </ul>
          <a class="next" id="fake-day-next"><span class="blind">다음 날짜</span></a>
        </div>
      </div>
    `;
    document.getElementById("fake-day-next")!.addEventListener("click", () => {
      document.getElementById("ym")!.textContent = "2026년 11월";
    });

    const open = loadOpenModule() as OpenApi & {
      scrapeAllSearchHorizontalCalendarWithPaging: (
        doc: Document,
        options: Record<string, unknown>,
      ) => Promise<Record<string, unknown> | null>;
      getLastDateStripPagingMeta: () => { reason?: string; clicks?: number } | null;
    };

    const OriginalMouseEvent = globalThis.MouseEvent;
    (globalThis as unknown as { MouseEvent: typeof Event }).MouseEvent =
      class extends Event {} as unknown as typeof Event;
    try {
      await open.scrapeAllSearchHorizontalCalendarWithPaging(document, {
        maxDateStripClicks: 6,
        anchorYearMonth: "202608",
        prepareStrip: false,
        dateStripPostClickMs: 20,
      });
    } finally {
      globalThis.MouseEvent = OriginalMouseEvent;
    }

    expect(open.getLastDateStripPagingMeta()?.reason).toBe("clicked_month_pager");
  });

  it("never falls back to ly_wrap month next when price strip exists", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="prev">이전달</button>
        <button class="next" id="ly-next">다음달</button>
        <em>2027년 7월</em>
        <table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
      </div>
      <div class="dep-calendar-strip">
        <ul>
          <li><span class="num">16</span><span class="amt">164만</span></li>
          <li><span class="num">17</span><span class="amt">269만</span></li>
          <li><span class="num">18</span><span class="amt">194만</span></li>
        </ul>
        <a class="next" id="strip-day-next"><span class="blind">다음 날짜</span></a>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      findMonthNavButton: (doc: Document, direction: "next" | "prev") => Element | null;
    };
    const btn = open.findMonthNavButton(document, "next");
    // 가격 스트립만 있고 월 버튼이 없으면 null — ly-next로 폴백하면 안 됨
    expect(btn).toBeNull();
  });

  it("describeCalendarDomState separates ly_wrap YM from price strip header", () => {
    document.body.innerHTML = `
      <div class="ly_wrap">
        <button class="prev">이전달</button>
        <button class="next">다음달</button>
        <em>2027년 7월</em>
        <table><tbody><tr><td>1</td></tr></tbody></table>
      </div>
      <div class="calendar_wrap dep-calendar-strip">
        <div class="calendar_header"><em>2026년 8월</em></div>
        <ul>
          <li><span class="num">16</span><span class="amt">164만</span></li>
          <li><span class="num">17</span><span class="amt">269만</span></li>
          <li><span class="num">18</span><span class="amt">194만</span></li>
        </ul>
      </div>
    `;
    const open = loadOpenModule() as OpenApi & {
      describeCalendarDomState: (doc: Document) => {
        lyWrapYearMonth: string | null;
        headerClass: string | null;
        priceDayCellCount: number;
      };
    };
    const state = open.describeCalendarDomState(document);
    expect(state.lyWrapYearMonth).toBe("202707");
    expect(state.priceDayCellCount).toBeGreaterThanOrEqual(3);
    expect((state.headerClass ?? "").toString()).not.toContain("ly_wrap");
  });

});
