import { isAbsolute } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import { intakeVideoClipsFromPackage } from "@/lib/marketing/assets/video/intake/orchestrate";
import type { IncomingVideoProbe } from "@/lib/marketing/assets/video/intake/probe";

export type IntakeMarketingVideoClipsCliOptions = {
  packageRoot?: string;
  dryRun: boolean;
  confirmDev: boolean;
};

export function parseIntakeMarketingVideoClipsArgs(argv: string[]): IntakeMarketingVideoClipsCliOptions {
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

export async function runIntakeMarketingVideoClipsCommand(input: {
  options: IntakeMarketingVideoClipsCliOptions;
  probe?: IncomingVideoProbe;
}): Promise<Record<string, unknown>> {
  if (!input.options.packageRoot || !isAbsolute(input.options.packageRoot)) {
    throw new MarketingAssetExportError("--package-root must be an absolute package path");
  }

  if (input.options.dryRun) {
    const result = await intakeVideoClipsFromPackage({
      packageRoot: input.options.packageRoot,
      persist: false,
      probe: input.probe,
    });
    return {
      dryRun: true,
      network: false,
      filesystem: false,
      mediaGeneration: false,
      transcode: false,
      ...result,
    };
  }

  if (!input.options.confirmDev) {
    throw new MarketingAssetExportError("Refusing to write clip-intake.json without --confirm-dev");
  }

  const result = await intakeVideoClipsFromPackage({
    packageRoot: input.options.packageRoot,
    persist: true,
    probe: input.probe,
  });
  return {
    dryRun: false,
    network: false,
    filesystem: result.persisted,
    mediaGeneration: false,
    transcode: false,
    ...result,
  };
}
