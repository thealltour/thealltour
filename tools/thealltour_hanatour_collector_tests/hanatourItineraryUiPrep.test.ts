import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type UiPrepApi = {
  findDayAccordionEntries: (doc: Document) => Array<{ dayNumber: number; headerEl: Element; panelEl: Element }>;
  findDaySubTabs: (doc: Document) => Array<{ dayNumber: number; el: Element }>;
};

function loadUiPrepModule(): UiPrepApi {
  runInThisContext(readFileSync(path.join(extDir, "hanatourItineraryUiPrep.js"), "utf8"), {
    filename: "hanatourItineraryUiPrep.js",
  });
  const api = (globalThis as { HanatourItineraryUiPrep?: UiPrepApi }).HanatourItineraryUiPrep;
  if (!api) throw new Error("HanatourItineraryUiPrep was not exported");
  return api;
}

// 실제 상품 상세페이지(major-products 부모탭에서 열리는 CHPC0PKG... 페이지)에서 관찰된
// 마크업 재현: 상단에 "N일차" 앵커(<a>)로만 구성된 탐색용 탭 스트립이 있고, 그 아래
// 본문에는 일차별 헤더(<a>, ARIA 없음)와 그 형제 <div>(실제 내용)가 이어진다.
// 헤더가 <a>라는 이유로 findDayAccordionEntries가 후보에서 제외돼 0건이 나오던 버그를
// 재현/검증한다.
function renderRealWorldItineraryPage() {
  document.body.innerHTML = `
    <header class="gnb"><nav>GNB 링크들...</nav></header>
    <main>
      <div class="day-nav-strip">
        <ul>
          <li><a><span>1일차</span></a></li>
          <li><a><span>2일차</span></a></li>
          <li><a><span>3일차</span></a></li>
        </ul>
        <a><span>이전일차</span></a>
        <a><span>다음일차</span></a>
      </div>
      <a>일정 전체닫힘</a>
      <div class="day-block">
        <a><span><strong>1일차</strong>08/29(토)</span><strong>인천, 시드니</strong><p>상세내용을 확인해보세요</p></a>
        <div class="day-panel">
          <p>1일차 본문 내용입니다. 인천에서 출발해 시드니로 이동합니다. 조식/중식/석식 안내와 관광지 카드가 이어집니다.</p>
        </div>
      </div>
      <div class="day-block">
        <a><span><strong>2일차</strong>08/30(일)</span><strong>시드니</strong><p>본다이 비치, 갭 파크</p></a>
        <div class="day-panel">
          <p>2일차 본문 내용입니다. 본다이 비치와 갭 파크를 관광합니다. 식사와 호텔 정보가 이어집니다.</p>
        </div>
      </div>
      <div class="day-block">
        <a><span><strong>3일차</strong>08/31(월)</span><strong>시드니, 카툼바</strong><p>블루마운틴 국립공원</p></a>
        <div class="day-panel">
          <p>3일차 본문 내용입니다. 블루마운틴 국립공원을 관광하고 카툼바에서 숙박합니다. 조식/중식/석식 안내가 이어집니다.</p>
        </div>
      </div>
    </main>
  `;
}

describe("hanatourItineraryUiPrep findDayAccordionEntries", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds <a> accordion headers and their sibling panels even when scope is the whole main/body", () => {
    renderRealWorldItineraryPage();
    const ui = loadUiPrepModule();

    const entries = ui.findDayAccordionEntries(document);
    expect(entries.map((e) => e.dayNumber)).toEqual([1, 2, 3]);

    const day1 = entries.find((e) => e.dayNumber === 1)!;
    expect(day1.panelEl.textContent).toContain("1일차 본문 내용");
    expect(day1.panelEl.textContent).not.toContain("2일차 본문 내용");

    const day2 = entries.find((e) => e.dayNumber === 2)!;
    expect(day2.panelEl.textContent).toContain("2일차 본문 내용");
    expect(day2.panelEl.textContent).not.toContain("1일차 본문 내용");
  });

  it("still finds the top nav-strip day tabs separately via findDaySubTabs", () => {
    renderRealWorldItineraryPage();
    const ui = loadUiPrepModule();

    const tabs = ui.findDaySubTabs(document);
    expect(tabs.map((t) => t.dayNumber)).toEqual([1, 2, 3]);
  });
});
