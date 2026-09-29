import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { createCardNewsVerificationBrief, parseMarketingAssetManifest, sha256Buffer } from "@/lib/marketing/assets";
import { resolveCardNewsGeometry, type CardNewsAspectRatio } from "@/lib/marketing/assets/cardnews/brand";
import {
  buildInstagramThumbnailSpec,
  buildInstagramThumbnailSvg,
  instagramThumbnailBaselines,
  resolveInstagramThumbnailSafeRect,
} from "@/lib/marketing/assets/cardnews/instagramThumbnail";
import {
  renderCardNewsPackage,
  type CardNewsRenderDocument,
} from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
import { measureTextWidth } from "@/lib/marketing/assets/cardnews/textLayout";

const THUMB = "cardnews/1x1/card-00.png";
const LEGACY_THUMB = "cardnews/1x1/card-01-instagram_thumbnail.png";
const NOW = new Date("2026-09-28T00:00:00.000Z");
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

async function seedRoot(): Promise<{ root: string; visualPath: string }> {
  const root = mkdtempSync(join(tmpdir(), "cardnews-thumb-"));
  tempDirs.push(root);
  const visualPath = join(root, "cover.png");
  await sharp({ create: { width: 640, height: 400, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .png()
    .toFile(visualPath);
  return { root, visualPath };
}

function renderWith(
  seed: { root: string; visualPath: string },
  aspectRatio: CardNewsAspectRatio,
  instagramThumbnailTitle: string | null,
  dryRun = false,
) {
  return renderCardNewsPackage({
    mediaBrief: createCardNewsVerificationBrief(),
    assetRoot: seed.root,
    aspectRatio,
    visuals: { "card-cover": seed.visualPath },
    allowedVisualRoots: [seed.root],
    persistMediaBrief: false,
    instagramThumbnailTitle,
    dryRun,
    now: NOW,
  });
}

function readRenderJson(packageRoot: string, dir: string): { bytes: string; doc: CardNewsRenderDocument } {
  const bytes = readFileSync(join(packageRoot, dir, "render.json"), "utf8");
  return { bytes, doc: JSON.parse(bytes) as CardNewsRenderDocument };
}

function manifestPaths(packageRoot: string): string[] {
  return parseMarketingAssetManifest(
    JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8")),
  ).artifacts.map((a) => a.relativePath);
}

function fileSha(packageRoot: string, relativePath: string): string {
  return sha256Buffer(readFileSync(join(packageRoot, relativePath)));
}

describe("Instagram thumbnail variant — layout", () => {
  it("fits the title alone inside the 15/15/10/15% safe area, centered, at most 3 lines", () => {
    const geo = resolveCardNewsGeometry("1:1");
    expect(resolveInstagramThumbnailSafeRect(geo)).toEqual({ x: 162, y: 108, width: 756, height: 810 });

    const short = buildInstagramThumbnailSpec({
      cardId: "card-cover",
      title: "제주 억새",
      visualDataUri: null,
      preserveAspectRatio: "xMidYMid slice",
      geometry: geo,
    });
    const long = buildInstagramThumbnailSpec({
      cardId: "card-cover",
      title: "가을 제주 억새 명소를 가장 한적하게 걷는 방법과 시간대, 주차와 대중교통까지 한 번에 정리한 안내서입니다",
      visualDataUri: null,
      preserveAspectRatio: "xMidYMid slice",
      geometry: geo,
    });
    const overflowing = buildInstagramThumbnailSpec({
      cardId: "card-cover",
      title: "제주 억새 명소 ".repeat(10).slice(0, 80),
      visualDataUri: null,
      preserveAspectRatio: "xMidYMid slice",
      geometry: geo,
    });
    const comma = buildInstagramThumbnailSpec({
      cardId: "card-cover",
      title: "가을 제주 억새, 사람 적은 시간에 걷는 법",
      visualDataUri: null,
      preserveAspectRatio: "xMidYMid slice",
      geometry: geo,
    });
    expect(short.title.fontSize).toBeGreaterThan(long.title.fontSize);
    expect(overflowing.title.ellipsisApplied).toBe(true);
    expect(comma.title.lines.slice(1).some((line) => /^[,.]/.test(line))).toBe(false);
    for (const spec of [short, long, overflowing, comma]) {
      expect(spec.title.lines.length).toBeGreaterThan(0);
      expect(spec.title.lines.length).toBeLessThanOrEqual(3);
      for (const line of spec.title.lines) {
        expect(measureTextWidth(line, spec.title.fontSize)).toBeLessThanOrEqual(spec.safe.width);
      }
      const baselines = instagramThumbnailBaselines(spec);
      expect(baselines[0]! - spec.title.fontSize).toBeGreaterThanOrEqual(spec.safe.y);
      expect(baselines.at(-1)!).toBeLessThanOrEqual(spec.safe.y + spec.safe.height);
      const top = baselines[0]! - spec.title.fontSize * 0.8;
      const bottom = baselines.at(-1)! + spec.title.fontSize * 0.2;
      expect(Math.abs(top - spec.safe.y - (spec.safe.y + spec.safe.height - bottom))).toBeLessThanOrEqual(
        spec.title.lineHeight,
      );
    }

    const svg = buildInstagramThumbnailSvg(short, geo);
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('x="540"');
    expect(svg).not.toContain("<image");
  });
});

describe("Instagram thumbnail variant — renderCardNewsPackage", () => {
  it("adds the 1:1 first-card variant only with a title and leaves normal cards untouched", async () => {
    const seed = await seedRoot();

    const plain = await renderWith(seed, "1:1", null);
    const pkg = plain.packageRoot;
    const plainCards = plain.render!.cards;
    const plainRenderJson = readRenderJson(pkg, "cardnews/1x1");
    expect(plainRenderJson.doc.variants).toBeUndefined();
    expect(existsSync(join(pkg, THUMB))).toBe(false);

    const dry = await renderWith(seed, "1:1", "  제주 가을 억새 명소  ", true);
    const titled = await renderWith(seed, "1:1", "  제주 가을 억새 명소  ");
    expect(dry.plannedRelativePaths).toEqual(titled.plannedRelativePaths);
    expect(titled.plannedRelativePaths).toContain(THUMB);
    expect(titled.plannedRelativePaths.indexOf(THUMB)).toBe(plainCards.length);

    expect(titled.render!.cards).toEqual(plainCards);
    expect(fileSha(pkg, "cardnews/1x1/card-01.png")).toBe(plainCards[0]!.sha256);
    const png = readFileSync(join(pkg, THUMB));
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1080, 1080, "png"]);
    expect(sha256Buffer(png)).not.toBe(plainCards[0]!.sha256);

    const titledRenderJson = readRenderJson(pkg, "cardnews/1x1").doc;
    expect(titledRenderJson.cards).toHaveLength(plainCards.length);
    expect(titledRenderJson.variants).toEqual([
      expect.objectContaining({
        cardIndex: 1,
        variant: "instagram_thumbnail",
        sourceBriefCardId: "card-cover",
        relativePath: THUMB,
        width: 1080,
        height: 1080,
        sha256: sha256Buffer(png),
        visualAssetId: "local:card-cover",
      }),
    ]);
    expect(manifestPaths(pkg)).toContain(THUMB);

    const cleared = await renderWith(seed, "1:1", "   ");
    expect(existsSync(join(pkg, THUMB))).toBe(false);
    expect(manifestPaths(pkg)).not.toContain(THUMB);
    expect(cleared.artifacts.map((a) => a.relativePath)).not.toContain(THUMB);
    expect(readRenderJson(pkg, "cardnews/1x1").bytes).toBe(plainRenderJson.bytes);
    expect(fileSha(pkg, "cardnews/1x1/card-01.png")).toBe(plainCards[0]!.sha256);
  }, 240_000);

  it("removes a thumbnail left under the old variant file name", async () => {
    const seed = await seedRoot();
    const plain = await renderWith(seed, "1:1", null);
    const legacyAbsolute = join(plain.packageRoot, LEGACY_THUMB);
    writeFileSync(legacyAbsolute, readFileSync(join(plain.packageRoot, "cardnews/1x1/card-01.png")));

    await renderWith(seed, "1:1", "제주 가을 억새 명소");
    expect(existsSync(legacyAbsolute)).toBe(false);
    expect(existsSync(join(plain.packageRoot, THUMB))).toBe(true);
    expect(manifestPaths(plain.packageRoot)).not.toContain(LEGACY_THUMB);
  }, 240_000);

  it("ignores the title on 4:5 renders", async () => {
    const seed = await seedRoot();
    const plain = await renderWith(seed, "4:5", null);
    const plainRenderJson = readRenderJson(plain.packageRoot, "cardnews").bytes;

    const titled = await renderWith(seed, "4:5", "제주 가을 억새 명소");
    expect(titled.plannedRelativePaths.some((p) => p.endsWith("card-00.png"))).toBe(false);
    expect(titled.render!.variants).toBeUndefined();
    expect(titled.render!.cards).toEqual(plain.render!.cards);
    expect(readRenderJson(titled.packageRoot, "cardnews").bytes).toBe(plainRenderJson);
    expect(manifestPaths(titled.packageRoot).some((p) => p.endsWith("card-00.png"))).toBe(false);
  }, 240_000);
});
