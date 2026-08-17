export const BAND_IMPORT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const BAND_IMPORT_IMAGE_MIME: Record<(typeof BAND_IMPORT_IMAGE_EXTS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_BAND_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BAND_IMPORT_VISION_IMAGES = 40;
/** zip 폴더 중첩·대량 사진으로 함수 타임아웃 나지 않게 추출 상한 */
export const MAX_BAND_IMPORT_EXTRACT_IMAGES = 40;

/** 클라이언트가 브라우저에서 Supabase Storage로 직접 올리는 임시 업로드 버킷 (zip/사진 원본). */
export const BAND_IMPORT_STAGING_BUCKET = "band-import-staging";
/** zip 전체 용량 상한 — Vercel 서버리스 함수의 4.5MB 요청 본문 제한과 무관 (직접 업로드로 우회). */
export const MAX_BAND_IMPORT_ZIP_BYTES = 100 * 1024 * 1024;

export type BandImageRole = "hero" | "gallery" | "dayCover" | "event" | "skip";

export type BandImportImageSource = {
  name: string;
  bytes: Uint8Array;
  type?: string;
};

export type BandImportExtractedImage = {
  filename: string;
  bytes: Buffer;
  contentType: string;
};

export type BandImportUploadedImage = {
  url: string;
  filename: string;
  contentType: string;
  bytes?: Buffer;
};

export type BandImageAssignment = {
  index: number;
  role: BandImageRole;
  day?: number | null;
  eventHeading?: string | null;
};

export function getFilenameExt(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const parts = base.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function isBandImportImageExt(ext: string): ext is (typeof BAND_IMPORT_IMAGE_EXTS)[number] {
  return (BAND_IMPORT_IMAGE_EXTS as readonly string[]).includes(ext);
}

export function mimeFromImageExt(ext: string): string {
  if (isBandImportImageExt(ext)) return BAND_IMPORT_IMAGE_MIME[ext];
  return "application/octet-stream";
}

/** 확장자가 실제 포맷과 다를 때(네이버 zip 등) 스토리지 MIME 검증을 통과시키기 위한 매직 바이트 판별 */
export function detectImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
