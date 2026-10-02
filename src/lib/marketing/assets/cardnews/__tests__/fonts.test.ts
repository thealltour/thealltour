// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ensureCardNewsFonts } from "@/lib/marketing/assets/cardnews/fonts";
import { rasterizeCardNewsSvg } from "@/lib/marketing/assets/cardnews/raster";
import { resolveCardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import { measureTextWidth, wrapTextDetailed } from "@/lib/marketing/assets/cardnews/textLayout";

describe("bundled cardnews fonts", () => {
  it("measures emoji as one glyph and never splits a ZWJ sequence during wrapping", () => {
    expect(measureTextWidth("👩🏽‍💻", 40)).toBe(50);
    expect(measureTextWidth("✈️", 40)).toBe(50);
    const lines = wrapTextDetailed("👩🏽‍💻👩🏽‍💻", 40, 60).lines;
    expect(lines).toEqual(["👩🏽‍💻", "👩🏽‍💻"]);
  });
  it("registers CJK and color emoji in the isolated fontconfig", () => {
    const fonts = ensureCardNewsFonts();
    expect(fonts.fallbackPaths).toHaveLength(3);
    expect(readFileSync(fonts.configPath, "utf8")).toContain("Noto Sans CJK JP");
    for (const path of fonts.fallbackPaths) expect(readFileSync(path).length).toBeGreaterThan(1_000_000);
  });

  it.skipIf(process.platform !== "linux")("selects fonts that cover Korean, CJK, kana and emoji", () => {
    const fonts = ensureCardNewsFonts();
    const env = { ...process.env, FONTCONFIG_FILE: fonts.configPath, FONTCONFIG_PATH: fonts.directory };
    for (const [charset, family] of [["ac00", "Pretendard"], ["56db", "Noto Sans CJK JP"], ["3042", "Noto Sans CJK JP"], ["30ab", "Noto Sans CJK JP"], ["1f4cc", "Noto Color Emoji"]]) {
      expect(execFileSync("fc-list", [`:charset=${charset}`, "family"], { env, encoding: "utf8" })).toContain(family);
    }
  });

  it.skipIf(process.platform !== "linux")("rasterizes colored emoji, including a variation selector and ZWJ sequence", async () => {
    for (const emoji of ["📌", "🍜", "✈️", "👩🏽‍💻"]) {
      const png = await rasterizeCardNewsSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><text x="100" y="200" font-family="Pretendard, Noto Sans CJK JP, Noto Color Emoji" font-size="100" fill="#000">${emoji}</text></svg>`, resolveCardNewsGeometry("1:1"));
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let colored = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i + 3]! > 128 && Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 30) colored++;
      }
      expect(colored, emoji).toBeGreaterThan(100);
    }
  }, 30_000);

  it.skipIf(process.platform !== "linux")("keeps a leading emoji at the authored position and scales small copy", async () => {
    for (const size of [24, 48]) {
      const png = await rasterizeCardNewsSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><text x="80" y="200" font-family="Pretendard, Noto Sans CJK JP, Noto Color Emoji" font-size="${size}" fill="#000"><tspan x="80" y="200">📌프로필 링크</tspan></text></svg>`, resolveCardNewsGeometry("1:1"));
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const xs: number[] = [], ys: number[] = [];
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i + 3]! > 128 && Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 30) {
          const pixel = i / info.channels;
          xs.push(pixel % info.width); ys.push(Math.floor(pixel / info.width));
        }
      }
      expect(xs.length).toBeGreaterThan(20);
      expect(Math.min(...xs)).toBeLessThan(90);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(size * 1.3);
    }
  });
});
