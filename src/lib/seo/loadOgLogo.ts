import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** public/thealltour-logo.png → data URL (OG ImageResponse용). 없으면 null. */
export async function loadTheallLogoDataUrl(): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", "thealltour-logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
