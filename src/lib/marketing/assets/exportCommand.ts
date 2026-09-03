import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  createDailyMarketingRunRepository,
  isDailyMarketingRunRepositoryConfigured,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";

import { type MarketingAssetEnv } from "@/lib/marketing/assets/config";
import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import {
  exportMarketingCandidatePackage,
  type ExportMarketingCandidatePackageResult,
} from "@/lib/marketing/assets/exportMarketingCandidatePackage";

export type ExportMarketingCandidateAssetsCliOptions = {
  candidateId: string;
  root?: string;
  dryRun: boolean;
};

export function parseExportMarketingCandidateAssetsArgs(
  argv: string[],
): ExportMarketingCandidateAssetsCliOptions {
  let candidateId: string | undefined;
  let root: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--candidateId" || arg.startsWith("--candidateId=")) {
      candidateId = arg === "--candidateId" ? argv[index + 1] : arg.slice("--candidateId=".length);
      if (arg === "--candidateId") index += 1;
      continue;
    }
    if (arg === "--root" || arg.startsWith("--root=")) {
      root = arg === "--root" ? argv[index + 1] : arg.slice("--root=".length);
      if (arg === "--root") index += 1;
      continue;
    }
    throw new MarketingAssetExportError(`Unknown argument: ${arg}`);
  }

  const trimmedCandidateId = candidateId?.trim();
  if (!trimmedCandidateId) {
    throw new MarketingAssetExportError("Missing required --candidateId");
  }

  return {
    candidateId: trimmedCandidateId,
    root: root?.trim() || undefined,
    dryRun,
  };
}

export async function runExportMarketingCandidateAssetsCommand(input: {
  options: ExportMarketingCandidateAssetsCliOptions;
  env?: MarketingAssetEnv;
  repository?: DailyMarketingRunRepository;
}): Promise<ExportMarketingCandidatePackageResult> {
  const env = input.env ?? process.env;
  let repository = input.repository;
  if (!repository) {
    if (!isDailyMarketingRunRepositoryConfigured(env)) {
      throw new MarketingAssetExportError(
        "Candidate repository is not configured. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    repository = await createDailyMarketingRunRepository({ backend: "supabase", env });
  }

  const candidate = await repository.findCandidateByCandidateId(input.options.candidateId);
  if (!candidate) {
    throw new MarketingAssetExportError(`Candidate not found: ${input.options.candidateId}`);
  }

  return exportMarketingCandidatePackage({
    candidate,
    assetRoot: input.options.root,
    env,
    dryRun: input.options.dryRun,
  });
}
