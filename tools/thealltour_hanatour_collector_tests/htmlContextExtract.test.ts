import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type HtmlExtractApi = {
  buildCleanHtmlStructure: (doc: Document) => string;
  buildBodyHtmlCaptureRoot: (doc: Document) => Element | null;
};

function loadHtmlExtractModule(): HtmlExtractApi {
  runInThisContext(readFileSync(path.join(extDir, "htmlContextExtract.js"), "utf8"), {
    filename: "htmlContextExtract.js",
  });
  const api = (globalThis as { HtmlContextExtract?: HtmlExtractApi }).HtmlContextExtract;
  if (!api) throw new Error("HtmlContextExtract was not exported");
  return api;
}

function renderNoisyProductPage() {
  const longSection = Array.from({ length: 10 }, (_, i) => {
    const day = i + 1;
    return `<div role="tabpanel"><h2>${day}일차</h2><p>${day}일차 상세 일정 본문 — 관광·식사·호텔 안내가 포함됩니다.</p></div>`;
  }).join("");

  document.body.innerHTML = `
    <header class="gnb_wrap">
      <nav>GNB 메뉴</nav>
      <a href="/other">다른 상품 rprsProdCds=WRONG</a>
    </header>
    <main>
      <aside class="recent_prod">최근 본 상품 배너 내용</aside>
      <div class="prod_detail_top">
        <h1>스페인·포르투갈 10일</h1>
        <p>성인 1인 2,690,000원</p>
      </div>
      <section class="included_excluded">
        <h3>포함내역</h3>
        <p>왕복항공권, 숙박, 조식, 가이드, 차량, 여행자보험</p>
        <h3>불포함내역</h3>
        <p>개인경비, 유류할증료, 선택관광</p>
      </section>
      <div class="detail_wrap">
        <div class="tab_cont_wrap">${longSection}</div>
      </div>
      <section class="review_area">
        <select><option>전체</option><option>최신순</option></select>
        <p>후기 필터 영역</p>
        <div class="review_list"><button>다른 상품 보기 A</button><button>다른 상품 보기 B</button></div>
      </section>
      <div class="recommend_prod">함께 많이 본 상품 목록</div>
      <section class="related_block">
        <strong>함께 많이 본 상품</strong>
        <ul>
          <li><button>[출발확정] 스페인/포르투갈 8일</button></li>
          <li><button>[출발확정] 이탈리아 9일</button></li>
        </ul>
      </section>
      <div class="review_wrap">
        <h3>구매고객 후기</h3>
        <p>총 128건</p>
        <ul><li>후기 본문 샘플</li></ul>
      </div>
      <div class="app_banner">앱 설치 쿠폰팩 받기</div>
    </main>
    <footer class="footer_wrap">푸터 링크</footer>
  `;
}

describe("htmlContextExtract body blacklist scoping", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("captures full body (blacklist applied in buildCleanHtmlStructure, not in root)", () => {
    renderNoisyProductPage();
    const api = loadHtmlExtractModule();
    const root = api.buildBodyHtmlCaptureRoot(document);

    expect(root).toBe(document.body);
    expect(root!.textContent).toMatch(/10일차/);
    expect(root!.textContent).toMatch(/포함내역/);
  });

  it("buildCleanHtmlStructure keeps product body and removes gnb/footer/select noise", () => {
    renderNoisyProductPage();
    const api = loadHtmlExtractModule();
    const html = api.buildCleanHtmlStructure(document);

    expect(html.length).toBeGreaterThan(800);
    expect(html).toMatch(/스페인·포르투갈 10일/);
    expect(html).toMatch(/10일차/);
    expect(html).toMatch(/포함내역/);
    expect(html).not.toMatch(/GNB/);
    expect(html).not.toMatch(/최근 본 상품/);
    expect(html).not.toMatch(/후기 필터/);
    expect(html).not.toMatch(/다른 상품 보기/);
    expect(html).not.toMatch(/함께 많이 본/);
    expect(html).not.toMatch(/구매고객 후기/);
    expect(html).not.toMatch(/\[출발확정\]/);
    expect(html).not.toMatch(/스페인\/포르투갈 8일/);
    expect(html).not.toMatch(/쿠폰팩/);
    expect(html).not.toMatch(/푸터/);
    expect(html).not.toMatch(/<select/i);
  });
});
