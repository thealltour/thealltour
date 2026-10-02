import sharp from "sharp";
import type { CardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import { isEmojiGrapheme, textGraphemes } from "@/lib/marketing/assets/cardnews/textLayout";

/** librsvg paints color-font glyphs as a silhouette. Pango's RGBA text path preserves color. */
export async function prepareColorEmojiSvg(svg: string, geo: CardNewsGeometry): Promise<string> {
  const nodes = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gu)];
  for (const node of nodes) {
    if (!/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(node[2]!)) continue;
    const attrs = node[1]!;
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`, "u").exec(attrs)?.[1];
    const size = Number(attr("font-size"));
    const family = attr("font-family");
    const fill = attr("fill") ?? "#000000";
    if (!size || !family) continue;
    const weight = Number(attr("font-weight") ?? 400) >= 700 ? "Bold" : "Regular";
    const spans = [...node[2]!.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/gu)];
    const lines = spans.length ? spans.map((span) => ({ svg: span[0], text: span[2]! })) : [{ svg: node[2]!, text: node[2]! }];
    const images: string[] = [];
    for (const line of lines) {
      if (!line.text.trim()) continue;
      // Measure the original SVG ink bounds to keep the existing baseline and layout.
      // Exclude the shadow from measurement; reapply it to the resulting image group.
      const measuredAttrs = attrs.replace(/\sstyle="[^"]*"/gu, "");
      // COLRv1 glyphs have no monochrome outline in librsvg. A same-size Hangul
      // probe keeps leading emoji from shifting the whole line to its first ordinary letter.
      const probeLine = textGraphemes(line.svg).map((part) => isEmojiGrapheme(part) ? "가" : part).join("");
      const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}" height="${geo.height}"><text${measuredAttrs}>${probeLine}</text></svg>`;
      const { info } = await sharp(Buffer.from(probe)).trim({ background: "#00000000" }).png().toBuffer({ resolveWithObject: true });
      const png = await sharp({ text: {
        text: `<span foreground="${fill}">${line.text}</span>`,
        font: `${family} ${weight} ${size}`,
        dpi: 72,
        rgba: true,
      } }).png().toBuffer();
      const metadata = await sharp(png).metadata();
      const y = -(info.trimOffsetTop ?? 0) - Math.max(0, (metadata.height! - info.height) / 2);
      images.push(`<image x="${-(info.trimOffsetLeft ?? 0)}" y="${y}" width="${metadata.width}" height="${metadata.height}" href="data:image/png;base64,${png.toString("base64")}"/>`);
    }
    const style = attr("style");
    svg = svg.replace(node[0], `<g${style ? ` style="${style}"` : ""}>${images.join("")}</g>`);
  }
  return svg;
}
