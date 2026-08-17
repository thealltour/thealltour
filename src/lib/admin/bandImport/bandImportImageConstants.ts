export const BAND_IMPORT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const BAND_IMPORT_IMAGE_MIME: Record<(typeof BAND_IMPORT_IMAGE_EXTS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_BAND_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BAND_IMPORT_VISION_IMAGES = 40;

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
