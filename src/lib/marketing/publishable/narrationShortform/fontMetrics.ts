import { readFileSync } from "node:fs";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { NarrationError } from "../narration/persistence";

/** `libassVerticalUnits` is the face height libass sizes to (usWinAscent+usWinDescent, else typo ascender−descender), as in libass `set_font_metrics`. */
export type FontMetrics = { sha256: string; unitsPerEm: number; ascender: number; descender: number; libassVerticalUnits: number; advance(codePoint: number): number };
const cache = new Map<string, FontMetrics>();
/** Advance widths from OTF cmap/hmtx. Shaping/kerning is not modeled; render-time libass bounds stay authoritative. */
export function loadFontMetrics(path: string): FontMetrics {
  const bytes = readFileSync(path); const sha256 = sha256Buffer(bytes); const cached = cache.get(`${path}:${sha256}`); if (cached) return cached;
  const tables = new Map<string, number>();
  try {
    for (let i = 0, count = bytes.readUInt16BE(4); i < count; i++) tables.set(bytes.toString("latin1", 12 + i * 16, 16 + i * 16), bytes.readUInt32BE(20 + i * 16));
    const head = tables.get("head")!; const hhea = tables.get("hhea")!; const hmtx = tables.get("hmtx")!; const cmap = tables.get("cmap")!;
    const unitsPerEm = bytes.readUInt16BE(head + 18); const ascender = bytes.readInt16BE(hhea + 4); const descender = bytes.readInt16BE(hhea + 6); const hmetrics = bytes.readUInt16BE(hhea + 34);
    const os2 = tables.get("OS/2"); const win = os2 === undefined ? 0 : bytes.readInt16BE(os2 + 74) + bytes.readInt16BE(os2 + 76); const typo = os2 === undefined ? 0 : bytes.readInt16BE(os2 + 68) - bytes.readInt16BE(os2 + 70);
    const libassVerticalUnits = win || typo; if (libassVerticalUnits <= 0) throw new NarrationError("자막 글꼴의 세로 메트릭(OS/2)을 읽지 못했습니다.", 503);
    let format12: number | null = null; let format4: number | null = null;
    for (let i = 0, count = bytes.readUInt16BE(cmap + 2); i < count; i++) {
      const record = cmap + 4 + i * 8; const platform = bytes.readUInt16BE(record); const encoding = bytes.readUInt16BE(record + 2); const offset = cmap + bytes.readUInt32BE(record + 4);
      if (platform === 3 && encoding === 10 && bytes.readUInt16BE(offset) === 12) format12 = offset;
      if (platform === 3 && encoding === 1 && bytes.readUInt16BE(offset) === 4) format4 = offset;
    }
    const glyph = (cp: number) => {
      if (format12 !== null) {
        for (let i = 0, groups = bytes.readUInt32BE(format12 + 12); i < groups; i++) { const g = format12 + 16 + i * 12; const start = bytes.readUInt32BE(g); const end = bytes.readUInt32BE(g + 4); if (cp >= start && cp <= end) return bytes.readUInt32BE(g + 8) + cp - start; }
        return 0;
      }
      if (format4 === null || cp > 0xffff) return 0;
      const segments = bytes.readUInt16BE(format4 + 6) / 2; const ends = format4 + 14; const starts = ends + segments * 2 + 2; const deltas = starts + segments * 2; const ranges = deltas + segments * 2;
      for (let i = 0; i < segments; i++) {
        if (cp > bytes.readUInt16BE(ends + i * 2) || cp < bytes.readUInt16BE(starts + i * 2)) continue;
        const range = bytes.readUInt16BE(ranges + i * 2); const delta = bytes.readInt16BE(deltas + i * 2);
        if (!range) return (cp + delta) & 0xffff;
        const id = bytes.readUInt16BE(ranges + i * 2 + range + (cp - bytes.readUInt16BE(starts + i * 2)) * 2); return id ? (id + delta) & 0xffff : 0;
      }
      return 0;
    };
    const widths = new Map<number, number>();
    const advance = (cp: number) => {
      const known = widths.get(cp); if (known !== undefined) return known;
      const id = glyph(cp); if (!id && cp !== 0x20) throw new NarrationError("자막 글꼴에 없는 글자가 있습니다. 해당 Narration 문장을 검토해주세요.", 409);
      const width = bytes.readUInt16BE(hmtx + Math.min(id, hmetrics - 1) * 4); widths.set(cp, width); return width;
    };
    const metrics = { sha256, unitsPerEm, ascender, descender, libassVerticalUnits, advance }; cache.set(`${path}:${sha256}`, metrics); return metrics;
  } catch (error) { if (error instanceof NarrationError) throw error; throw new NarrationError("자막 글꼴 정보를 읽지 못했습니다.", 503); }
}
/** `emPx` is the em size: advance units scale by emPx / unitsPerEm. */
export function textWidthPx(metrics: FontMetrics, text: string, emPx: number) { let units = 0; for (const c of text) units += metrics.advance(c.codePointAt(0)!); return units * emPx / metrics.unitsPerEm; }
/** libass advances each `\N` line by the sized face height, i.e. the ASS FontSize. */
export function lineHeightPx(metrics: FontMetrics, emPx: number) { return metrics.libassVerticalUnits * emPx / metrics.unitsPerEm; }
/** ASS FontSize that makes libass render the given em size (FreeType REAL_DIM request = libassVerticalUnits). */
export function assFontSizeForEm(metrics: FontMetrics, emPx: number) { return Math.round(emPx * metrics.libassVerticalUnits / metrics.unitsPerEm * 1000) / 1000; }
/** The em libass actually renders for a (rounded) ASS FontSize; width and height checks use this, never the unrounded design value. */
export function renderedEmPx(metrics: FontMetrics, emPx: number) { return assFontSizeForEm(metrics, emPx) * metrics.unitsPerEm / metrics.libassVerticalUnits; }
