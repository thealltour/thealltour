import sharp from "sharp";

import { CARDNEWS_HEIGHT, CARDNEWS_WIDTH } from "@/lib/marketing/assets/cardnews/brand";
import { withCardNewsFonts } from "@/lib/marketing/assets/cardnews/fonts";

export async function rasterizeCardNewsSvg(svg: string): Promise<Buffer> {
  return withCardNewsFonts(async () => {
    return sharp(Buffer.from(svg), { density: 72 })
      .resize(CARDNEWS_WIDTH, CARDNEWS_HEIGHT, { fit: "fill" })
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
