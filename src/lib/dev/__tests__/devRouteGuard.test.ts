/**
 * POST-UI-01E-C: Dev route production guard + legacy getProducts removal contracts.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertDevRoutesEnabled } from "@/lib/dev/assertDevRoutesEnabled";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walkTs(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

function relSrc(abs: string): string {
  return abs.replace(/\\/g, "/").replace(/.*\/src\//, "src/");
}

function hasGetProductsCall(filePath: string): boolean {
  const text = readFileSync(filePath, "utf8");
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//");
    })
    .some((line) => /\bgetProducts\s*\(/.test(line));
}

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

describe("assertDevRoutesEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls notFound in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertDevRoutesEnabled()).toThrow("NOT_FOUND");
  });

  it("allows development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertDevRoutesEnabled()).not.toThrow();
  });
});

describe("dev route pages production guard", () => {
  it("/dev/products uses assertDevRoutesEnabled", () => {
    const source = read("src/app/dev/products/page.tsx");
    expect(source).toContain("assertDevRoutesEnabled");
    expect(source).not.toMatch(/\bgetProducts\s*\(/);
    expect(source).toContain("getProductsPage");
  });

  it("/dev/product-detail/[id] uses assertDevRoutesEnabled", () => {
    const source = read("src/app/dev/product-detail/[id]/page.tsx");
    expect(source).toContain("assertDevRoutesEnabled");
    expect(source).not.toMatch(/\bgetProducts\s*\(/);
  });
});

describe("legacy getProducts removal", () => {
  it("products.ts does not export getProducts or getProductsCached", () => {
    const source = read("src/lib/products.ts");
    expect(source).not.toMatch(/export async function getProducts\s*\(/);
    expect(source).not.toMatch(/getProductsCached/);
  });

  it("repository has zero getProducts( callers", () => {
    const callers = walkTs(SRC)
      .filter((f) => !f.includes("__tests__") && hasGetProductsCall(f))
      .map(relSrc);
    expect(callers).toEqual([]);
  });
});

describe("dev listing data source", () => {
  it("dev products page uses paginated ProductListItem fetch", () => {
    const source = read("src/app/dev/products/page.tsx");
    expect(source).toContain("getProductsPage");
    expect(source).toContain("PRODUCT_LIST_PAGE_SIZE_MAX");
    expect(source).not.toMatch(/select\(\s*["']\*["']\s*\)/);
  });
});

describe("production navigation dev links", () => {
  it("no href to /dev in site chrome components", () => {
    const siteChrome = walkTs(resolve(SRC, "components/site-chrome"))
      .concat(walkTs(resolve(SRC, "components/header")))
      .concat(walkTs(resolve(SRC, "components/navigation")));
    const hits = siteChrome.filter((f) => /href=["']\/dev/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
