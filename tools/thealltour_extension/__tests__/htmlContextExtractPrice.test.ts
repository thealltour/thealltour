import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type HtmlContextExtractApi = {
  buildPageTextForMeta: (doc: Document, maxChars?: number) => string;
  findBookingPriceRoot: (doc: Document) => Element | null;
};

function loadHtmlContextExtract(): HtmlContextExtractApi {
  const existing = (globalThis as { HtmlContextExtract?: HtmlContextExtractApi }).HtmlContextExtract;
  if (existing?.buildPageTextForMeta) return existing;
  runInThisContext(readFileSync(path.join(extDir, "htmlContextExtract.js"), "utf8"), {
    filename: "htmlContextExtract.js",
  });
  const api = (globalThis as { HtmlContextExtract?: HtmlContextExtractApi }).HtmlContextExtract;
  if (!api?.buildPageTextForMeta) {
    throw new Error("HtmlContextExtract.buildPageTextForMeta was not exported");
  }
  return api;
}

beforeAll(() => {
  // jsdom does not implement innerText; approximate it with textContent so the
  // line-based stripping/appending logic in buildPageTextForMeta can be exercised.
  if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText")) {
    Object.defineProperty(HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? "";
      },
    });
  }
});

describe("buildPageTextForMeta price sidebar capture", () => {
  it("appends the booking price sidebar (.prod_detail_side) even though it sits outside <main>", () => {
    const { buildPageTextForMeta } = loadHtmlContextExtract();
    document.body.innerHTML = "";

    const main = document.createElement("main");
    main.textContent = "상품 소개\n식상한 시드니는 이제 그만!";
    document.body.appendChild(main);

    const side = document.createElement("div");
    side.className = "prod_detail_side";
    side.textContent = [
      "성인 1인",
      "2,649,000원",
      "5개월 무이자 할부 예상가",
      "월 529,800원",
      "카드사별 무이자 혜택",
    ].join("\n");
    document.body.appendChild(side);

    const text = buildPageTextForMeta(document);

    expect(text).toContain("[가격 정보]");
    expect(text).toContain("2,649,000원");
    expect(text).not.toMatch(/월 529,800원/);
  });

  it("does not duplicate the price section when it is already inside <main>", () => {
    const { buildPageTextForMeta } = loadHtmlContextExtract();
    document.body.innerHTML = "";

    const main = document.createElement("main");
    main.innerHTML = `<div class="prod_detail_side">성인 1인\n224,320원</div>`;
    document.body.appendChild(main);

    const text = buildPageTextForMeta(document);
    const occurrences = text.split("224,320원").length - 1;
    expect(occurrences).toBe(1);
    expect(text).not.toContain("[가격 정보]");
  });
});

describe("findBookingPriceRoot", () => {
  it("prefers the .prod_detail_side selector when present", () => {
    const { findBookingPriceRoot } = loadHtmlContextExtract();
    document.body.innerHTML = `<div class="prod_detail_side">성인 1인 1,000,000원</div>`;
    const root = findBookingPriceRoot(document);
    expect(root?.className).toBe("prod_detail_side");
  });

  it("falls back to text heuristics (성인 1인 + 원화 금액) when no known class exists", () => {
    const { findBookingPriceRoot } = loadHtmlContextExtract();
    document.body.innerHTML = `<aside class="unknown-widget">성인 1인 224,320원</aside>`;
    const root = findBookingPriceRoot(document);
    expect(root?.className).toBe("unknown-widget");
  });
});
