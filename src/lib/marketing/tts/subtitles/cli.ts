import { isAbsolute } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import {
  generateSubtitlesFromTimelinePackage,
  readAudioMasterTimelineFromPackage,
} from "@/lib/marketing/tts/subtitles/orchestrate";
import { renderSrtFromTimeline } from "@/lib/marketing/tts/subtitles/render";

export type GenerateMarketingSubtitlesCliOptions = {
  packageRoot?: string;
  dryRun: boolean;
  confirmDev: boolean;
};

export function parseGenerateMarketingSubtitlesArgs(argv: string[]): GenerateMarketingSubtitlesCliOptions {
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

export function runGenerateMarketingSubtitlesCommand(input: {
  options: GenerateMarketingSubtitlesCliOptions;
}): Record<string, unknown> {
  if (!input.options.packageRoot || !isAbsolute(input.options.packageRoot)) {
    throw new MarketingAssetExportError("--package-root must be an absolute package path");
  }

  if (input.options.dryRun) {
    const timeline = readAudioMasterTimelineFromPackage(input.options.packageRoot);
    const srt = renderSrtFromTimeline(timeline);
    return {
      dryRun: true,
      network: false,
      filesystem: false,
      cueCount: timeline.segments.length,
      relativePath: "reel/subtitles.srt",
      srt,
    };
  }

  if (!input.options.confirmDev) {
    throw new MarketingAssetExportError("Refusing to write subtitles.srt without --confirm-dev");
  }

  const result = generateSubtitlesFromTimelinePackage({
    packageRoot: input.options.packageRoot,
  });
  return {
    dryRun: false,
    network: false,
    filesystem: true,
    ...result,
  };
}
