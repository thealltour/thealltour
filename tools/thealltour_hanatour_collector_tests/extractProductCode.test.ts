import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type ProductCodeApi = {
  extractHanatourProductCodes: (doc: Document) => {
    saleProdCd: string | null;
    rprsProdCd: string | null;
    depDay: string | null;
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

describe("extractHanatourProductCodes URL extras", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("picks rprsProdCds from the page URL when extractFromUrl runs", () => {
    const { extractHanatourProductCodes } = loadProductCode();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://www.hanatour.com/package/major-products?rprsProdCds=MPA1114"),
    });
    const codes = extractHanatourProductCodes(document);
    expect(codes.rprsProdCd).toBe("MPA1114");
  });
});
