export const BAND_IMPORT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const BAND_IMPORT_IMAGE_MIME: Record<(typeof BAND_IMPORT_IMAGE_EXTS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_BAND_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BAND_IMPORT_VISION_IMAGES = 40;

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
