import sharp from "sharp";

import {
  resolveCardNewsGeometry,
  type CardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import { withCardNewsFonts } from "@/lib/marketing/assets/cardnews/fonts";

export async function rasterizeCardNewsSvg(
  svg: string,
  geometry?: CardNewsGeometry,
): Promise<Buffer> {
  const geo = geometry ?? resolveCardNewsGeometry();
  return withCardNewsFonts(async () => {
    return sharp(Buffer.from(svg), { density: 72 })
      .resize(geo.width, geo.height, { fit: "fill" })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: false,
        palette: false,
        effort: 7,
      })
      .toBuffer();
  });
}

export async function encodeLocalVisualDataUri(png: Buffer): Promise<string> {
  const normalized = await sharp(png)
    .rotate()
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  return `data:image/png;base64,${normalized.toString("base64")}`;
}
