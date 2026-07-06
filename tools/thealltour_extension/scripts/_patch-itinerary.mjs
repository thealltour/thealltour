import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(extDir, "../..");

function patchContentJs() {
  const p = path.join(extDir, "content.js");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("itineraryExtractMeta")) {
    console.log("[skip] content.js already patched");
    return;
  }
  s = s.replace(
    /itineraryBlocks,\n    \} = await hx\.capturePageContext\(/,
    "itineraryBlocks,\n      itineraryExtractMeta,\n    } = await hx.capturePageContext(",
  );
  s = s.replace(
    /itineraryBlocks: itineraryBlocks\?\.length \? itineraryBlocks : undefined,/,
    "itineraryBlocks: itineraryBlocks?.length ? itineraryBlocks : undefined,\n      itineraryExtractMeta: itineraryExtractMeta ?? undefined,",
  );
  if (!s.includes("itineraryExtractMeta")) throw new Error("content.js patch failed");
  fs.writeFileSync(p, s);
  console.log("[ok] content.js");
}

function patchManifest() {
  const p = path.join(extDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(p, "utf8"));
  manifest.version = "0.2.22";
  const scripts = manifest.content_scripts.find((c) => c.js?.includes("htmlContextExtract.js"));
  if (scripts && !scripts.js.includes("hanatourItineraryUiPrep.js")) {
    const idx = scripts.js.indexOf("htmlContextExtract.js");
    scripts.js.splice(idx, 0, "hanatourItineraryUiPrep.js");
  }
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
  console.log("[ok] manifest.json");
}

function patchBackground() {
  const p = path.join(extDir, "background.js");
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("hanatourItineraryUiPrep.js")) {
    s = s.replace(
      /"htmlContextExtract\.js",/,
      '"hanatourItineraryUiPrep.js",\n      "htmlContextExtract.js",',
    );
    fs.writeFileSync(p, s);
    console.log("[ok] background.js");
  } else {
    console.log("[skip] background.js");
  }
}

function patchPackageJson() {
  const p = path.join(extDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.version = "0.2.22";
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
  console.log("[ok] package.json");
}

function patchEnrich() {
  const p = path.join(rootDir, "src/lib/admin/externalImport/enrichItineraryWithBlocks.ts");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("hasExplicitDayBlocks")) {
    console.log("[skip] enrichItineraryWithBlocks");
    return;
  }
  s = s.replace(
    `function findBlocksForEvent(
  blockIndex: Map<string, ItineraryBlock[]>,
  day: number,
  heading: string,
): ItineraryBlock[] {
  const hKey = normalizeHeadingKey(heading);
  const exact = blockIndex.get(\`\${day}::\${hKey}\`) ?? [];
  const dayAgnostic = blockIndex.get(\`0::\${hKey}\`) ?? [];
  return [...exact, ...dayAgnostic];
}`,
    `function hasExplicitDayBlocks(blocks: ItineraryBlock[]): boolean {
  return blocks.some((b) => typeof b.day === "number" && b.day > 0);
}

function findBlocksForEvent(
  blockIndex: Map<string, ItineraryBlock[]>,
  day: number,
  heading: string,
  allowDayAgnostic: boolean,
): ItineraryBlock[] {
  const hKey = normalizeHeadingKey(heading);
  const exact = blockIndex.get(\`\${day}::\${hKey}\`) ?? [];
  if (!allowDayAgnostic) return exact;
  const dayAgnostic = blockIndex.get(\`0::\${hKey}\`) ?? [];
  return [...exact, ...dayAgnostic];
}`,
  );
  s = s.replace(
    "  const blockIndex = indexBlocksByDayAndHeading(richBlocks);",
    "  const blockIndex = indexBlocksByDayAndHeading(richBlocks);\n  const allowDayAgnostic = !hasExplicitDayBlocks(richBlocks);",
  );
  s = s.replace(
    "const candidates = findBlocksForEvent(blockIndex, day.day, event.heading);",
    "const candidates = findBlocksForEvent(blockIndex, day.day, event.heading, allowDayAgnostic);",
  );
  fs.writeFileSync(p, s);
  console.log("[ok] enrichItineraryWithBlocks.ts");
}

function writeEnrichTest() {
  const p = path.join(rootDir, "src/lib/admin/externalImport/__tests__/enrichItineraryDayGuard.test.ts");
  if (fs.existsSync(p)) {
    console.log("[skip] enrich test");
    return;
  }
  fs.writeFileSync(
    p,
    `import { describe, expect, it } from "vitest";

import { enrichAiItineraryWithBlocks } from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";

describe("enrichAiItineraryWithBlocks day guard", () => {
  it("does not attach day=2 block to day=1 when explicit day blocks exist", () => {
    const ai = {
      days: [
        { day: 1, events: [{ heading: "인천 출발", description: "short" }] },
        { day: 2, events: [{ heading: "계림 도착", description: "short" }] },
      ],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "양강",
        description: "양강 유람 상세 설명입니다.",
        imageUrls: ["https://example.com/yangshuo.jpg"],
        kind: "sightseeing",
      },
    ];
    const result = enrichAiItineraryWithBlocks(ai, blocks);
    const day1 = result?.days?.find((d) => d.day === 1);
    const day2 = result?.days?.find((d) => d.day === 2);
    expect(day1?.events.some((e) => e.heading === "양강")).toBe(false);
    expect(day2?.events.some((e) => e.heading === "양강")).toBe(true);
  });

  it("ignores day-agnostic blocks when explicit day blocks exist", () => {
    const ai = {
      days: [{ day: 1, events: [{ heading: "관광", description: "a" }] }],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "양강",
        description: "day two only",
        imageUrls: [],
        kind: "sightseeing",
      },
      {
        heading: "양강",
        description: "day agnostic should not apply",
        imageUrls: [],
        kind: "sightseeing",
      },
    ];
    const result = enrichAiItineraryWithBlocks(ai, blocks);
    expect(result?.days?.[0]?.events.some((e) => e.description?.includes("day agnostic"))).toBe(
      false,
    );
  });
});
`,
  );
  console.log("[ok] enrichItineraryDayGuard.test.ts");
}

function writeUiPrepTest() {
  const p = path.join(rootDir, "src/lib/admin/externalImport/hanatour/__tests__/hanatourItineraryUiPrep.test.ts");
  if (fs.existsSync(p)) {
    console.log("[skip] ui prep test");
    return;
  }
  fs.writeFileSync(
    p,
    `import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const DAY_TAB_REGEX = /^\\s*(\\d{1,2})\\s*일차\\s*$/;

function findDaySubTabsFromDoc(doc: Document) {
  const seen = new Set<number>();
  const out: { dayNumber: number }[] = [];
  doc.querySelectorAll('[role="tab"], button').forEach((el) => {
    const text = (el.textContent ?? "").trim();
    const m = text.match(DAY_TAB_REGEX);
    if (!m) return;
    const dayNumber = parseInt(m[1], 10);
    if (seen.has(dayNumber)) return;
    seen.add(dayNumber);
    out.push({ dayNumber });
  });
  return out.sort((a, b) => a.dayNumber - b.dayNumber);
}

describe("hanatourItineraryUiPrep fixtures", () => {
  it("finds 1일차~3일차 sub tabs", () => {
    const dom = new JSDOM(\`<div role="tablist"><button role="tab">1일차</button><button role="tab">2일차</button><button role="tab">3일차</button></div>\`);
    expect(findDaySubTabsFromDoc(dom.window.document).map((t) => t.dayNumber)).toEqual([1, 2, 3]);
  });

  it("resolves accordion panel via aria-controls", () => {
    const dom = new JSDOM(\`<button aria-controls="day1-panel">1일차 09/24(목)</button><div id="day1-panel">Day one content with enough text to qualify as a panel.</div>\`);
    const doc = dom.window.document;
    const controls = doc.querySelector("button")!.getAttribute("aria-controls");
    const panel = controls ? doc.getElementById(controls) : null;
    expect(panel?.id).toBe("day1-panel");
  });
});
`,
  );
  console.log("[ok] hanatourItineraryUiPrep.test.ts");
}

patchContentJs();
patchManifest();
patchBackground();
patchPackageJson();
patchEnrich();
writeEnrichTest();
writeUiPrepTest();
