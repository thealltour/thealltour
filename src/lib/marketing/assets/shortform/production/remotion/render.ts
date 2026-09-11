import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import { SHORTFORM_OUTPUT_PROFILE_V1 } from "@/lib/marketing/assets/shortform/production/paths";
import type { TravelShortInfoV1Props } from "@/lib/marketing/assets/shortform/production/remotion/TravelShortInfoV1";
import {
  resolveAllowedShortformMediaRoot,
  stageTravelShortInfoMediaForRemotion,
} from "@/lib/marketing/assets/shortform/production/remotion/mediaSrc";

export type ShortformRemotionRenderInput = {
  compositionId: "TravelShortInfoV1";
  props: TravelShortInfoV1Props;
  outputAbsolutePath: string;
  signal?: AbortSignal;
};

export type ShortformRemotionRenderer = {
  render(input: ShortformRemotionRenderInput): Promise<{ outputAbsolutePath: string }>;
};

/** Test/CI renderer — writes a tiny placeholder file (not a real MP4). */
export class FakeShortformRemotionRenderer implements ShortformRemotionRenderer {
  async render(input: ShortformRemotionRenderInput) {
    if (input.signal?.aborted) {
      throw new ShortformProductionError("remotion aborted", "REMOTION_ABORTED");
    }
    writeFileSync(input.outputAbsolutePath, Buffer.from("fake-remotion-output"));
    return { outputAbsolutePath: input.outputAbsolutePath };
  }
}

/**
 * Production Remotion renderer (bundler + renderMedia).
 * Local workspace media is copied as regular files into publicDir; Remotion copies
 * that tree into the webpack bundle so OffthreadVideo can fetch http(s) via staticFile().
 */
export class ProductionShortformRemotionRenderer implements ShortformRemotionRenderer {
  async render(input: ShortformRemotionRenderInput) {
    if (input.signal?.aborted) {
      throw new ShortformProductionError("remotion aborted", "REMOTION_ABORTED");
    }
    try {
      const { bundle } = await import("@remotion/bundler");
      const { renderMedia, selectComposition } = await import("@remotion/renderer");
      const entry = join(
        process.cwd(),
        "src/lib/marketing/assets/shortform/production/remotion/entry.tsx",
      );
      const publicDir = join(dirname(input.outputAbsolutePath), "remotion-public");
      mkdirSync(publicDir, { recursive: true });
      const stagedProps = stageTravelShortInfoMediaForRemotion({
        props: input.props,
        publicDir,
        allowedRoot: resolveAllowedShortformMediaRoot(),
      });
      const serveUrl = await bundle({
        entryPoint: entry,
        publicDir,
        symlinkPublicDir: false,
      });
      const composition = await selectComposition({
        serveUrl,
        id: input.compositionId,
        inputProps: stagedProps as unknown as Record<string, unknown>,
      });
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: input.outputAbsolutePath,
        inputProps: stagedProps as unknown as Record<string, unknown>,
        chromiumOptions: {},
        timeoutInMilliseconds: 180_000,
      });
      return { outputAbsolutePath: input.outputAbsolutePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : "remotion_failed";
      throw new ShortformProductionError(message, "REMOTION_RENDER_FAILED");
    }
  }
}

export function defaultRemotionOutputPath(renderDir: string) {
  return join(renderDir, `composition-${SHORTFORM_OUTPUT_PROFILE_V1.width}x${SHORTFORM_OUTPUT_PROFILE_V1.height}.mp4`);
}
