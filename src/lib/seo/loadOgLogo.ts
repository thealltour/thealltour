import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { THEALL_WORDMARK_DARK_SRC } from "@/lib/brandAssets";

/** public 다크 워드마크 → data URL (OG ImageResponse용). 없으면 null. */
export async function loadTheallWordmarkDarkDataUrl(): Promise<string | null> {
  try {
    const relative = THEALL_WORDMARK_DARK_SRC.replace(/^\//, "");
    const buf = await readFile(join(process.cwd(), "public", relative));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * OG 카드용 브랜드 마크.
 * 통일 미리보기에서는 다크 워드마크를 사용한다.
 */
export async function loadTheallLogoDataUrl(): Promise<string | null> {
  const wordmark = await loadTheallWordmarkDarkDataUrl();
  if (wordmark) return wordmark;
  try {
    const buf = await readFile(join(process.cwd(), "public", "thealltour-logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
