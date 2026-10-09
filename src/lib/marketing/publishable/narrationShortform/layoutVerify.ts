import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import type { FontMetrics } from "./fontMetrics";
import { layoutBox, type PixelBox } from "./layoutPolicy";
import { filterPath } from "./motionGraph";
import { renderLayoutProbeAss } from "./motionSubtitles";

export type OverlayProbe = { kind: "caption" | "hook"; text: string };
/** Renders each overlay alone with libass over mid-gray and measures the ink box, including outline, shadow and antialiasing. */
export async function measureOverlayBounds(input: { items: OverlayProbe[]; metrics: FontMetrics; fontDirectory: string; workDirectory: string; width?: number; height?: number }) {
  const width = input.width ?? 720; const height = input.height ?? 1280; const count = input.items.length; if (!count) return [];
  const assPath = join(input.workDirectory, "layout-probe.ass"); const rawPath = join(input.workDirectory, "layout-probe.gray");
  atomicWriteFile(assPath, renderLayoutProbeAss(input.items, input.metrics, width, height));
  await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x808080:s=${width}x${height}:r=10:d=${(count / 10).toFixed(1)}`,
    "-vf", `ass=filename='${filterPath(assPath)}':fontsdir='${filterPath(input.fontDirectory)}',format=gray`, "-frames:v", String(count), "-f", "rawvideo", rawPath], timeoutMs: 5 * 60_000 });
  const raw = readFileSync(rawPath); const frame = width * height;
  return input.items.map((item, k) => {
    const pixels = raw.subarray(k * frame, (k + 1) * frame); const background = pixels[0]!; let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.abs(pixels[y * width + x]! - background) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const box = layoutBox(item.kind, width, height); const bounds: PixelBox | null = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
    return { ...item, box, bounds, inside: !!bounds && bounds.x0 >= box.x0 && bounds.y0 >= box.y0 && bounds.x1 <= box.x1 && bounds.y1 <= box.y1 };
  });
}
