import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  THEALL_WORDMARK_DARK_SRC,
  THEALL_WORDMARK_LIGHT_SRC,
} from "@/lib/brandAssets";

function mimeForPublicImage(relative: string, buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  const lower = relative.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/** `public/` 상대 경로 → OG ImageResponse용 data URL. 없으면 null. */
export async function loadPublicImageDataUrl(publicRelativePath: string): Promise<string | null> {
  try {
    const relative = publicRelativePath.replace(/^\//, "");
    const buf = await readFile(join(process.cwd(), "public", relative));
    return `data:${mimeForPublicImage(relative, buf)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** public 다크 워드마크 → data URL (OG ImageResponse용). 없으면 null. */
export async function loadTheallWordmarkDarkDataUrl(): Promise<string | null> {
  return loadPublicImageDataUrl(THEALL_WORDMARK_DARK_SRC);
}

/** 밝은 OG 카드용 라이트 모드 워드마크. */
export async function loadTheallWordmarkLightDataUrl(): Promise<string | null> {
  return loadPublicImageDataUrl(THEALL_WORDMARK_LIGHT_SRC);
}

/**
 * OG 카드용 브랜드 마크.
 * 밝은 셸에서는 라이트 모드 워드마크를 기본 사용한다.
 */
export async function loadTheallLogoDataUrl(): Promise<string | null> {
  const wordmark = await loadTheallWordmarkLightDataUrl();
  if (wordmark) return wordmark;
  const darkWordmark = await loadTheallWordmarkDarkDataUrl();
  if (darkWordmark) return darkWordmark;
  return loadPublicImageDataUrl("thealltour-logo.png");
}
