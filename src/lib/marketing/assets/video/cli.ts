import { isAbsolute } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { buildAiVideoShotList } from "@/lib/marketing/assets/video/map";
import { renderAiVideoPromptMarkdown } from "@/lib/marketing/assets/video/markdown";
import { generateAiVideoShotPack, readMediaBriefFromPackage } from "@/lib/marketing/assets/video/orchestrate";
import { readAudioMasterTimelineFromPackage } from "@/lib/marketing/tts/subtitles/orchestrate";

export type GenerateMarketingVideoShotsCliOptions = {
  packageRoot?: string;
  dryRun: boolean;
  confirmDev: boolean;
  fixture: boolean;
};

export function parseGenerateMarketingVideoShotsArgs(argv: string[]): GenerateMarketingVideoShotsCliOptions {
  let packageRoot: string | undefined;
  let dryRun = false;
  let confirmDev = false;
  let fixture = false;

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
    if (arg === "--fixture") {
      fixture = true;
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
    fixture,
  };
}

export function runGenerateMarketingVideoShotsCommand(input: {
  options: GenerateMarketingVideoShotsCliOptions;
}): Record<string, unknown> {
  if (!input.options.packageRoot || !isAbsolute(input.options.packageRoot)) {
    throw new MarketingAssetExportError("--package-root must be an absolute package path");
  }

  const mediaBrief = input.options.fixture
    ? createA8VerificationBrief()
    : readMediaBriefFromPackage(input.options.packageRoot);

  if (input.options.dryRun) {
    const timeline = readAudioMasterTimelineFromPackage(input.options.packageRoot);
    const { shotList, prompts } = buildAiVideoShotList({ mediaBrief, timeline });
    return {
      dryRun: true,
      network: false,
      filesystem: false,
      mediaGeneration: false,
      shotCount: shotList.shots.length,
      shotList,
      markdown: renderAiVideoPromptMarkdown({ shotList, prompts }),
    };
  }

  if (!input.options.confirmDev) {
    throw new MarketingAssetExportError("Refusing to write video shot artifacts without --confirm-dev");
  }

  const result = generateAiVideoShotPack({
    packageRoot: input.options.packageRoot,
    mediaBrief,
  });
  return {
    dryRun: false,
    network: false,
    filesystem: true,
    mediaGeneration: false,
    ...result,
  };
}
