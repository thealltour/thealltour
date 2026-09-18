/**
 * Normalize uploaded shared visuals to PNG for CardNews renderer (PNG-only path).
 * Writes ephemeral files under OS tmp — not persisted package artifacts.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import { detectImageMime } from "@/lib/admin/bandImport/bandImportImageConstants";

export class SharedVisualNormalizeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SharedVisualNormalizeError";
    this.code = code;
  }
}

function renderCacheDir(): string {
  const dir = join(tmpdir(), "thealltour-shared-visual-render");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Absolute cache root for JPEG/WEBP→PNG intermediates (must be in allowedVisualRoots). */
export function getSharedVisualRenderCacheDir(): string {
  return renderCacheDir();
}

/**
 * Returns a local filesystem path to a PNG the CardNews renderer can read.
 * PNG uploads are returned as-is (caller must already path-validate).
 * JPEG/WEBP are converted via sharp into a content-addressed temp PNG.
 */
export async function normalizeSharedVisualToPngPath(input: {
  absoluteSourcePath: string;
  sourceBytes: Buffer;
  visualId: string;
}): Promise<{ pngPath: string; normalized: boolean; mimeType: string }> {
  const mime = detectImageMime(input.sourceBytes);
  if (!mime) {
    throw new SharedVisualNormalizeError(
      "unsupported_image",
      `Unsupported image for visual ${input.visualId}`,
    );
  }

  if (mime === "image/png") {
    return {
      pngPath: input.absoluteSourcePath,
      normalized: false,
      mimeType: mime,
    };
  }

  const digest = createHash("sha256").update(input.sourceBytes).digest("hex").slice(0, 24);
  const outPath = join(renderCacheDir(), `${input.visualId}-${digest}.png`);
  if (!existsSync(outPath)) {
    try {
      const png = await sharp(input.sourceBytes)
        .rotate()
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
      writeFileSync(outPath, png);
    } catch (error) {
      throw new SharedVisualNormalizeError(
        "normalize_failed",
        `Failed to normalize ${input.visualId} (${mime}) to PNG: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }

  return { pngPath: outPath, normalized: true, mimeType: mime };
}
