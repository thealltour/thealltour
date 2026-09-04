import { isAbsolute } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import { composeVideoPreviewFromPackage } from "@/lib/marketing/assets/video/preview/orchestrate";
import type { FfmpegRunner } from "@/lib/marketing/assets/video/preview/orchestrate";
import type { PreviewOutputProbe } from "@/lib/marketing/assets/video/preview/outputProbe";

export type ComposeMarketingVideoPreviewCliOptions = {
  packageRoot?: string;
  dryRun: boolean;
  confirmDev: boolean;
};

export function parseComposeMarketingVideoPreviewArgs(argv: string[]): ComposeMarketingVideoPreviewCliOptions {
  let packageRoot: string | undefined;
  let dryRun = false;
  let confirmDev = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--confirm-dev") {
      confirmDev = true;
      continue;
    }
    if (arg === "--package-root" || arg.startsWith("--package-root=")) {
      packageRoot = arg === "--package-root" ? argv[index + 1] : arg.slice("--package-root=".length);
      if (arg === "--package-root") index += 1;
      continue;
    }
    throw new MarketingAssetExportError(`Unknown argument: ${arg}`);
  }

  return {
    packageRoot: packageRoot?.trim() || undefined,
    dryRun,
    confirmDev,
  };
}

export async function runComposeMarketingVideoPreviewCommand(input: {
  options: ComposeMarketingVideoPreviewCliOptions;
  ffmpeg?: FfmpegRunner;
  outputProbe?: PreviewOutputProbe;
}): Promise<Record<string, unknown>> {
  if (!input.options.packageRoot || !isAbsolute(input.options.packageRoot)) {
    throw new MarketingAssetExportError("--package-root must be an absolute package path");
  }

  if (input.options.dryRun) {
    const result = await composeVideoPreviewFromPackage({
      packageRoot: input.options.packageRoot,
      persist: false,
      ffmpeg: input.ffmpeg,
      outputProbe: input.outputProbe,
    });
    return {
      dryRun: true,
      network: false,
      filesystem: false,
      mediaGeneration: false,
      tts: false,
      ffmpeg: false,
      transcode: false,
      ...result,
    };
  }

  if (!input.options.confirmDev) {
    throw new MarketingAssetExportError("Refusing to write preview artifacts without --confirm-dev");
  }

  const result = await composeVideoPreviewFromPackage({
    packageRoot: input.options.packageRoot,
    persist: true,
    ffmpeg: input.ffmpeg,
    outputProbe: input.outputProbe,
  });
  return {
    dryRun: false,
    network: false,
    filesystem: result.persisted,
    mediaGeneration: false,
    tts: false,
    ffmpeg: result.ffmpegInvoked,
    transcode: result.ffmpegInvoked,
    ...result,
  };
}
