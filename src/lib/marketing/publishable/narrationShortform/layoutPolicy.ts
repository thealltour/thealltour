import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { NarrationError } from "../narration/persistence";
import { stableFingerprint } from "../narration/fingerprint";
import { assFontSizeForEm, lineHeightPx, renderedEmPx, textWidthPx, type FontMetrics } from "./fontMetrics";

/** Project-chosen conservative 9:16 zones. Not a platform guarantee; platform validation remains pending. */
/** v2: fontSize values are em sizes at 720p (×1.5 at 1080p); ASS FontSize is derived from the pinned font's metrics. v1 passed the em value straight to ASS (rendered ≈0.69× em). */
export const SHORTFORM_LAYOUT_POLICY = {
  policyId: "cross-platform-conservative-v2", basis: "project_conservative_choice", platformValidation: "pending",
  fontSizeBasis: "em", assFontSizeRule: "em_px*(usWinAscent+usWinDescent)/unitsPerEm (libass REAL_DIM), rounded to 0.001",
  referenceWidth: 720, referenceHeight: 1280, textCenterX: 0.45,
  boxes: { requiredText: [0.10, 0.18, 0.80, 0.60], hook: [0.12, 0.22, 0.78, 0.34], caption: [0.12, 0.48, 0.78, 0.60] },
  caption: { fontSize: 40, bold: true, maxLines: 2, outline: 3, shadow: 1, padding: 4, anchor: "bottom", autoShrink: false },
  hook: { fontSize: 48, bold: true, maxLines: 2, outline: 3, shadow: 1, padding: 2, anchor: "top", autoShrink: false, templateId: "opening-top-v1", defaultDurationMs: 3000 },
  font: { family: "Noto Sans CJK KR", weight: "bold", file: "NotoSansCJKkr-Bold.otf", sha256: "26d0c6748500a0444844280b308f5b62c7ae92ac6c6ac88148e502dd211eb52a",
    sourceUrl: "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf" },
} as const;
export const CAPTION_FONT_INSTALL_DOC = "docs/marketing/narration-shortform-captions-v3.md";
export type LayoutBoxName = keyof typeof SHORTFORM_LAYOUT_POLICY.boxes;
export type PixelBox = { x0: number; y0: number; x1: number; y1: number };
export const layoutPolicyFingerprint = () => stableFingerprint(SHORTFORM_LAYOUT_POLICY);
/** Planner-facing zones as normalized [x0, y0, x1, y1] of a 9:16 frame. Text is overlaid later; images must not contain it. */
export function shortformLayoutGuide() {
  const { boxes } = SHORTFORM_LAYOUT_POLICY;
  return { policyId: SHORTFORM_LAYOUT_POLICY.policyId, coordinateSpace: "normalized_x0_y0_x1_y1_of_9x16_frame", captionBandAllScenes: boxes.caption, openingTextBandFirstSceneOnly: boxes.hook,
    requiredTextRegion: boxes.requiredText, rules: ["no readable text, captions or logos inside the image", "keep primary subjects and fine detail outside the caption band", "first scene: keep the opening-text band calm"] };
}
export function captionFontPath() { return process.env.NARRATION_SHORTFORM_BOLD_FONT_FILE || join(process.cwd(), "data/narration-fonts", SHORTFORM_LAYOUT_POLICY.font.file); }
/** Fail closed: no Regular, system-font or fontconfig fallback. Only the pinned Bold file may be measured or burned. */
export function verifiedCaptionFont() {
  const path = captionFontPath();
  if (!existsSync(path)) throw new NarrationError(`자막용 굵은 한국어 글꼴(${SHORTFORM_LAYOUT_POLICY.font.file})이 없습니다. ${CAPTION_FONT_INSTALL_DOC}의 설치 절차를 따라주세요.`, 503);
  const bytes = readFileSync(path); const sha256 = sha256Buffer(bytes);
  if (sha256 !== SHORTFORM_LAYOUT_POLICY.font.sha256) throw new NarrationError(`자막 글꼴 파일의 SHA256(${sha256.slice(0, 12)}…)이 고정값(${SHORTFORM_LAYOUT_POLICY.font.sha256.slice(0, 12)}…)과 다릅니다. ${CAPTION_FONT_INSTALL_DOC}의 설치 절차로 다시 설치해주세요.`, 503);
  return { path, bytes, sha256 };
}
/** 720×1280 pixel values are canonical; 1080×1920 multiplies them by exactly 1.5. */
export function layoutScale(width: number, height: number) {
  const scale = width / SHORTFORM_LAYOUT_POLICY.referenceWidth;
  if (![1, 1.5].includes(scale) || height !== SHORTFORM_LAYOUT_POLICY.referenceHeight * scale) throw new NarrationError("지원하지 않는 shortform 해상도입니다.", 409);
  return scale;
}
export function layoutBox(name: LayoutBoxName, width = 720, height = 1280): PixelBox {
  const scale = layoutScale(width, height); const [x0, y0, x1, y1] = SHORTFORM_LAYOUT_POLICY.boxes[name];
  const px = (value: number, size: number, edge: "start" | "end") => (edge === "start" ? Math.ceil : Math.floor)(Math.round(value * size) * scale);
  return { x0: px(x0, 720, "start"), y0: px(y0, 1280, "start"), x1: px(x1, 720, "end"), y1: px(y1, 1280, "end") };
}
type TextKind = "caption" | "hook";
export function textStyle(kind: TextKind, width = 720, height = 1280) {
  const scale = layoutScale(width, height); const style = SHORTFORM_LAYOUT_POLICY[kind]; const box = layoutBox(kind, width, height);
  const inset = (style.outline + style.padding) * scale; const shadow = style.shadow * scale;
  return { box, fontSize: style.fontSize * scale, outline: style.outline * scale, shadow, maxLines: style.maxLines, centerX: SHORTFORM_LAYOUT_POLICY.textCenterX * width,
    maxLineWidth: box.x1 - box.x0 - inset * 2 - shadow, maxTextHeight: box.y1 - box.y0 - inset * 2 - shadow,
    anchorY: style.anchor === "bottom" ? box.y1 - inset - shadow : box.y0 + inset, alignment: style.anchor === "bottom" ? 2 : 8 };
}
/** `fontSize` from textStyle is the design em; this is the matching ASS FontSize for the pinned font. */
export function assFontSize(metrics: FontMetrics, kind: TextKind, width = 720, height = 1280) { return assFontSizeForEm(metrics, textStyle(kind, width, height).fontSize); }
/** Breaks only at spaces unless one word is wider than a line. Returns null instead of shrinking type. */
export function wrapTextLines(metrics: FontMetrics, text: string, kind: TextKind, width = 720, height = 1280): string[] | null {
  const style = textStyle(kind, width, height); const em = renderedEmPx(metrics, style.fontSize); const measure = (value: string) => textWidthPx(metrics, value, em);
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean); if (!words.length) return null;
  const fitsHeight = (lines: number) => lines * lineHeightPx(metrics, em) <= style.maxTextHeight;
  const full = words.join(" "); if (measure(full) <= style.maxLineWidth) return fitsHeight(1) ? [full] : null;
  let best: string[] | null = null; let bestWidth = Infinity;
  for (let i = 1; i < words.length && style.maxLines >= 2; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")]; const widest = Math.max(...lines.map(measure));
    if (widest <= style.maxLineWidth && widest < bestWidth) { best = lines; bestWidth = widest; }
  }
  if (best) return fitsHeight(2) ? best : null;
  if (words.every(word => measure(word) <= style.maxLineWidth)) return null;
  const lines: string[] = []; let line = "";
  for (const c of full) { if (line && measure(line + c) > style.maxLineWidth) { lines.push(line.trim()); line = c === " " ? "" : c; } else line += c; }
  if (line.trim()) lines.push(line.trim());
  return lines.length <= style.maxLines && fitsHeight(lines.length) ? lines : null;
}
