import JSZip from "jszip";
import {
  getFilenameExt,
  isBandImportImageExt,
  mimeFromImageExt,
  MAX_BAND_IMPORT_EXTRACT_IMAGES,
  MAX_BAND_IMPORT_IMAGE_BYTES,
  type BandImportExtractedImage,
  type BandImportImageSource,
} from "@/lib/admin/bandImport/bandImportImageConstants";

export class BandImportImageError extends Error {
  readonly httpStatus: 400;

  constructor(message: string) {
    super(message);
    this.name = "BandImportImageError";
    this.httpStatus = 400;
  }
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function shouldSkipZipPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.endsWith("/")) return true;
  if (normalized.includes("__MACOSX/")) return true;
  const base = basename(normalized);
  return !base || base.startsWith(".") || base.startsWith("._");
}

function isZipSource(name: string, bytes: Uint8Array): boolean {
  if (/\.(hwp|hwpx)$/i.test(name)) return false;
  if (/\.zip$/i.test(name)) return true;
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function pushImage(
  out: BandImportExtractedImage[],
  filename: string,
  bytes: Buffer,
): void {
  const ext = getFilenameExt(filename);
  if (!isBandImportImageExt(ext)) return;
  if (bytes.length === 0 || bytes.length > MAX_BAND_IMPORT_IMAGE_BYTES) return;
  out.push({
    filename: basename(filename),
    bytes,
    contentType: mimeFromImageExt(ext),
  });
}

async function extractFromZip(bytes: Uint8Array, depth = 0): Promise<BandImportExtractedImage[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new BandImportImageError("zip 파일을 열 수 없습니다. 손상되지 않은 zip인지 확인해 주세요.");
  }

  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && !shouldSkipZipPath(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const out: BandImportExtractedImage[] = [];
  for (const entry of entries) {
    if (out.length >= MAX_BAND_IMPORT_EXTRACT_IMAGES) break;
    let buf: Buffer;
    try {
      buf = Buffer.from(await entry.async("uint8array"));
    } catch (error) {
      console.warn("[extractBandImportImages] zip entry skip:", entry.name, error);
      continue;
    }
    if (buf.length === 0) continue;

    const ext = getFilenameExt(entry.name);
    if (ext === "zip" && depth < 2) {
      try {
        out.push(...(await extractFromZip(buf, depth + 1)));
      } catch (error) {
        console.warn("[extractBandImportImages] nested zip skip:", entry.name, error);
      }
      continue;
    }
    if (!isBandImportImageExt(ext)) continue;
    pushImage(out, entry.name, buf);
  }
  return out.slice(0, MAX_BAND_IMPORT_EXTRACT_IMAGES);
}

export async function extractBandImportImages(
  sources: BandImportImageSource[],
): Promise<BandImportExtractedImage[]> {
  const out: BandImportExtractedImage[] = [];

  for (const source of sources) {
    const name = source.name?.trim() || "upload";
    const bytes = source.bytes;
    if (!bytes || bytes.length === 0) continue;

    if (isZipSource(name, bytes)) {
      const fromZip = await extractFromZip(bytes);
      if (fromZip.length === 0) {
        throw new BandImportImageError(
          "zip 안에서 jpg/jpeg/png/webp 사진을 찾지 못했습니다. 하위 폴더에 있어도 됩니다. bmp·heic·gif는 지원하지 않습니다.",
        );
      }
      out.push(...fromZip);
      continue;
    }

    const ext = getFilenameExt(name);
    if (!isBandImportImageExt(ext)) {
      throw new BandImportImageError("사진은 jpg, jpeg, png, webp 또는 그 확장자만 담긴 zip만 올릴 수 있습니다.");
    }
    if (bytes.length > MAX_BAND_IMPORT_IMAGE_BYTES) {
      throw new BandImportImageError("사진 한 장은 10MB 이하만 업로드할 수 있습니다.");
    }
    pushImage(out, name, Buffer.from(bytes));
  }

  return out.slice(0, MAX_BAND_IMPORT_EXTRACT_IMAGES);
}
