/**
 * PR-IMAGE-3: 다양한 래스터 포맷을 JPG로 통일 (렌더링 안정화). 서버 전용.
 * 브라우저에서의 PNG/JPG 변환은 `convertImageToBlob.ts`를 사용합니다.
 * (브라우저 JPG 품질 clamp·흰 배경 합성은 해당 모듈의 `clampJpegExportQuality` 등을 참고.)
 */

import sharp from "sharp";

export async function convertToJpg(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer).rotate().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}
