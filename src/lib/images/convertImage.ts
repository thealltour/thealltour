/**
 * PR-IMAGE-3: 다양한 래스터 포맷을 JPG로 통일 (렌더링 안정화).
 */

import sharp from "sharp";

export async function convertToJpg(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer).rotate().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}
