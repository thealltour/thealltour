import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type ProductCodeApi = {
  extractHanatourProductCodes: (doc: Document) => {
    saleProdCd: string | null;
    rprsProdCd: string | null;
    depDay: string | null;
    rprsSource?: string | null;
  };
};

function loadProductCode(): ProductCodeApi {
  runInThisContext(readFileSync(path.join(extDir, "hanatourCollectorCore.js"), "utf8"), {
    filename: "hanatourCollectorCore.js",
  });
  runInThisContext(readFileSync(path.join(extDir, "extractProductCode.js"), "utf8"), {
    filename: "extractProductCode.js",
  });
  const api = (globalThis as { HanatourProductCode?: ProductCodeApi }).HanatourProductCode;
  if (!api) throw new Error("HanatourProductCode was not exported");
  return api;
}

function stubLocation(href: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(href),
  });
}

const DETAIL_URL = "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=PAP101260827OZ3";

describe("extractHanatourProductCodes rprsProdCd fallback", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    stubLocation(DETAIL_URL);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("picks rprsProdCds from the page URL when extractFromUrl runs", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    stubLocation("https://www.hanatour.com/package/major-products?rprsProdCds=MPA1114");
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("MPA1114");
    expect(codes.rprsSource).toBe("url");
  });

  it("reads rprsProdCds from 다른 출발일 선택 href when the detail URL has no rprs", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    document.body.innerHTML = `
      <a href="/package/major-products?rprsProdCds=MPA1114&amp;strtDepDay=20260801">다른 출발일 선택</a>
    `;
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("MPA1114");
    expect(codes.saleProdCd).toBe("PAP101260827OZ3");
    expect(codes.rprsSource).toBe("href");
  });

  it("reads rprsProdCds from HTML/script regex when no URL param and no matching anchor", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    document.body.innerHTML = `<div data-cal>rprsProdCds=MPA1114</div>`;
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("MPA1114");
    expect(codes.rprsSource).toBe("regex");
  });

  it("prefers the page URL rprsProdCds over a different href on the same page", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    stubLocation("https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=PAP101260827OZ3&rprsProdCds=AAA9999");
    document.body.innerHTML = `<a href="/x?rprsProdCds=MPA1114">다른 출발일 선택</a>`;
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("AAA9999");
    expect(codes.rprsSource).toBe("url");
  });

  it("does not pick rprsProdCds from header/gnb when .prod_detail_top has the other-departure link", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    document.body.innerHTML = `
      <header>
        <a href="/package/major-products?rprsProdCds=MAK2330">다른 출발일 선택</a>
      </header>
      <div class="prod_detail_top">
        <a href="/package/major-products?rprsProdCds=MPA1114">다른 출발일 선택</a>
      </div>
    `;
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("MPA1114");
    expect(codes.rprsSource).toBe("href");
  });
});
