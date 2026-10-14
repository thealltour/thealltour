import { STOCK_CLIP_NORMALIZE_CONFIG, type StockRendition } from "./contracts";
const { width: W, height: H, maxScale, minRetainedArea } = STOCK_CLIP_NORMALIZE_CONFIG;
/** Cover-fit into 720x1280 with a center crop: how much the source is scaled and how much of its frame survives. */
export function renditionFit(width: number, height: number) {
  const scale = Math.max(W / width, H / height);
  const retainedArea = Math.min(1, (W / (width * scale)) * (H / (height * scale)));
  const orientation = height > width * 1.05 ? "portrait" as const : width > height * 1.05 ? "landscape" as const : "square" as const;
  return { scale: Math.round(scale * 10_000) / 10_000, retainedArea: Math.round(retainedArea * 10_000) / 10_000, orientation };
}
export const fitUsable = (fit: { scale: number; retainedArea: number }) => fit.scale <= maxScale && fit.retainedArea >= minRetainedArea;
/** Smallest rendition that needs neither upscaling nor an excessive crop, so downloads stay small. */
export function chooseRenderRendition(renditions: StockRendition[]) {
  const scored = renditions.map(rendition => ({ rendition, fit: renditionFit(rendition.width, rendition.height) }));
  const usable = scored.filter(item => fitUsable(item.fit)).sort((a, b) => a.rendition.width * a.rendition.height - b.rendition.width * b.rendition.height);
  if (usable[0]) return usable[0];
  if (!scored.length) return { reason: "no_usable_rendition" as const };
  return { reason: scored.some(item => item.fit.retainedArea >= minRetainedArea) ? "upscale_required" as const : "excessive_crop" as const };
}
/** Low-resolution playable file for human review only; never used for the render. */
export function choosePreviewRendition(renditions: StockRendition[]) {
  const sorted = [...renditions].sort((a, b) => a.width * a.height - b.width * b.height);
  return sorted.find(r => Math.min(r.width, r.height) >= 360) ?? sorted.at(-1) ?? null;
}
