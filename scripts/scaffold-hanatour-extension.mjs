import fs from "fs";
import path from "path";

const srcRoot = "tools/modetour-extractor-extension/src";
const dstRoot = "tools/hanatour-extractor-extension/src";

const pairs = [
  ["lib/domWait.ts", "lib/domWait.ts"],
  ["lib/itineraryKeywords.ts", "lib/itineraryKeywords.ts"],
  ["lib/parseText.ts", "lib/parseText.ts"],
  ["lib/modetourUiPrep.ts", "lib/hanatourUiPrep.ts"],
  ["lib/itineraryDom.ts", "lib/itineraryDom.ts"],
  ["lib/images.ts", "lib/images.ts"],
  ["lib/selectors.ts", "lib/selectors.ts"],
  ["lib/buildImport.ts", "lib/buildImport.ts"],
  ["lib/jsonLd.ts", "lib/jsonLd.ts"],
  ["lib/extractTypes.ts", "lib/extractTypes.ts"],
  ["types/modetourImport.ts", "types/hanatourImport.ts"],
  ["contents/modetour.ts", "contents/hanatour.ts"],
  ["popup.tsx", "popup.tsx"],
];

function xform(name, text) {
  let t = text;
  t = t.replace(/ModetourImportV1/g, "HanatourImportV1");
  t = t.replace(/ModetourImportWarning/g, "HanatourImportWarning");
  t = t.replace(/ModetourImageHeuristicHints/g, "HanatourImageHeuristicHints");
  t = t.replace(/modetour-import-v1/g, "hanatour-import-v1");
  t = t.replace(/provider: "modetour"/g, 'provider: "hanatour"');
  t = t.replace(/buildModetourImportV1/g, "buildHanatourImportV1");
  t = t.replace(/normalizeModetourImageUrl/g, "normalizeHanatourImageUrl");
  t = t.replace(/~lib\/modetourUiPrep/g, "~lib/hanatourUiPrep");
  t = t.replace(/www\.modetour\.com/g, "www.hanatour.com");
  t = t.replace(/img\.modetour\.com/g, "image.hanatour.com");
  t = t.replace(/modetour-extract/g, "hanatour-extract");
  t = t.replace(/모두투어/g, "하나투어");
  t = t.replace(/modetour\.com\/package/g, "hanatour.com/trp/pkg");
  t = t.replace(/isModetourPackageUrl/g, "isHanatourPackageUrl");
  t = t.replace(/~types\/modetourImport/g, "~types/hanatourImport");

  if (name.endsWith("types/hanatourImport.ts")) {
    t = fs.readFileSync("src/types/hanatourImport.ts", "utf8");
    t =
      "/**\n * 앱의 HanatourImportV1과 동일 구조 유지.\n */\n\n" +
      t.replace(/^export type HanatourImportV1/m, "export type HanatourImportV1");
  }

  if (name.endsWith("lib/extractTypes.ts")) {
    t = t.replace(
      /  inclusions\?:[\s\S]*?  detailTabs\?:[\s\S]*?  \};\n\n  media/,
      "  media",
    );
    t = t.replace(
      /source: \{\n    url: string;\n    fetchedAtISO: string;\n  \};/,
      `source: {
    url: string;
    fetchedAtISO: string;
    pkgCd?: string;
    ptnCd?: string;
    inpPathCd?: string;
    type?: string;
  };`,
    );
  }

  if (name.endsWith("lib/hanatourUiPrep.ts")) {
    t = t.replace(/export async function prepareItineraryUi/g, "export async function prepareHanatourItineraryUi");
  }

  if (name.endsWith("contents/hanatour.ts")) {
    t = t.replace(
      /matches: \["https:\/\/www\.modetour\.com\/package\/\*"\]/,
      'matches: ["https://www.hanatour.com/trp/pkg/*"]',
    );
    t = t.replace(/prepareItineraryUi/g, "prepareHanatourItineraryUi");
    if (!t.includes("parseHanatourUrlParams")) {
      t = t.replace(
        /export const config: PlasmoCSConfig = \{/,
        `function parseHanatourUrlParams(href: string): {
  pkgCd?: string;
  ptnCd?: string;
  inpPathCd?: string;
  type?: string;
} {
  try {
    const u = new URL(href);
    return {
      pkgCd: u.searchParams.get("pkgCd") ?? undefined,
      ptnCd: u.searchParams.get("ptnCd") ?? undefined,
      inpPathCd: u.searchParams.get("inpPathCd") ?? undefined,
      type: u.searchParams.get("type") ?? undefined,
    };
  } catch {
    return {};
  }
}

export const config: PlasmoCSConfig = {`,
      );
      t = t.replace(
        /source: \{\n        url: location\.href,\n        fetchedAtISO: new Date\(\)\.toISOString\(\),\n      \},/g,
        `source: {
        url: location.href,
        fetchedAtISO: new Date().toISOString(),
        ...parseHanatourUrlParams(location.href),
      },`,
      );
    }
  }

  if (name.endsWith("lib/buildImport.ts")) {
    t = t.replace(
      /source: \{\n      provider: "hanatour",\n      url: extracted\.source\.url,\n      fetchedAtISO: extracted\.source\.fetchedAtISO,\n    \},/,
      `source: {
      provider: "hanatour",
      url: extracted.source.url,
      fetchedAtISO: extracted.source.fetchedAtISO,
      pkgCd: extracted.source.pkgCd,
      ptnCd: extracted.source.ptnCd,
      inpPathCd: extracted.source.inpPathCd,
      type: extracted.source.type,
    },`,
    );
  }

  if (name.endsWith("lib/selectors.ts")) {
    t = t.replace(/모두투어 상품 상세 페이지 DOM/g, "하나투어 패키지 상세 DOM");
  }

  if (name.endsWith("popup.tsx")) {
    t = t.replace(
      /\/admin\/products\/new-modetour/g,
      "/admin/products/new-hanatour",
    );
    t = t.replace(
      /path\.startsWith\("\/package\/"\)/,
      'path.startsWith("/trp/pkg/")',
    );
  }

  return t;
}

for (const [src, dst] of pairs) {
  const srcPath = path.join(srcRoot, src);
  const dstPath = path.join(dstRoot, dst);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  const raw = fs.readFileSync(srcPath, "utf8");
  fs.writeFileSync(dstPath, xform(dst, raw));
}

const pkg = JSON.parse(fs.readFileSync("tools/modetour-extractor-extension/package.json", "utf8"));
pkg.name = "hanatour-extractor-extension";
pkg.displayName = "하나투어 상품 추출기";
pkg.version = "0.1.0";
pkg.description =
  "하나투어 패키지 상세(/trp/pkg/*)에서 HanatourImportV1 JSON 추출 및 클립보드 복사";
pkg.manifest.host_permissions = ["https://www.hanatour.com/*"];
fs.mkdirSync("tools/hanatour-extractor-extension", { recursive: true });
fs.writeFileSync(
  "tools/hanatour-extractor-extension/package.json",
  JSON.stringify(pkg, null, 2) + "\n",
);
fs.copyFileSync(
  "tools/modetour-extractor-extension/tsconfig.json",
  "tools/hanatour-extractor-extension/tsconfig.json",
);
fs.copyFileSync(
  "tools/modetour-extractor-extension/assets/icon.png",
  "tools/hanatour-extractor-extension/assets/icon.png",
);

console.log("scaffolded", pairs.length, "files");
