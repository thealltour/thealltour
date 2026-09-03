import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  createDailyMarketingRunRepository,
  isDailyMarketingRunRepositoryConfigured,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";

import { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
import { createCardNewsVerificationBrief } from "@/lib/marketing/assets/cardnews/fixture";
import {
  renderCardNewsPackage,
  type RenderCardNewsPackageResult,
} from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
import type { MarketingAssetEnv } from "@/lib/marketing/assets/config";
import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";

export type RenderMarketingCardNewsCliOptions = {
  candidateId?: string;
  root?: string;
  dryRun: boolean;
  graphicOnly: boolean;
  fixture: boolean;
};

export function parseRenderMarketingCardNewsArgs(argv: string[]): RenderMarketingCardNewsCliOptions {
  let candidateId: string | undefined;
  let root: string | undefined;
  let dryRun = false;
  let graphicOnly = false;
  let fixture = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--fixture") {
      fixture = true;
      continue;
    }
    if (arg === "--output-mode" || arg.startsWith("--output-mode=")) {
      const value = arg === "--output-mode" ? argv[index + 1] : arg.slice("--output-mode=".length);
      if (arg === "--output-mode") index += 1;
      if (value !== "graphic-only") {
        throw new MarketingAssetExportError(`Unsupported --output-mode: ${value}`);
      }
      graphicOnly = true;
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

  if (fixture && candidateId) {
    throw new MarketingAssetExportError("Use either --fixture or --candidateId, not both");
  }
  if (!fixture && !candidateId?.trim()) {
    throw new MarketingAssetExportError("Missing required --candidateId or --fixture");
  }

  return {
    candidateId: candidateId?.trim() || undefined,
    root: root?.trim() || undefined,
    dryRun,
    graphicOnly,
    fixture,
  };
}

export async function runRenderMarketingCardNewsCommand(input: {
  options: RenderMarketingCardNewsCliOptions;
  env?: MarketingAssetEnv;
  repository?: DailyMarketingRunRepository;
}): Promise<RenderCardNewsPackageResult> {
  const env = input.env ?? process.env;

  if (input.options.fixture) {
    return renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: input.options.root,
      env,
      dryRun: input.options.dryRun,
      graphicOnly: input.options.graphicOnly,
    });
  }

  let repository = input.repository;
  if (!repository) {
    if (!isDailyMarketingRunRepositoryConfigured(env)) {
      throw new MarketingAssetExportError(
        "Candidate repository is not configured. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    repository = await createDailyMarketingRunRepository({ backend: "supabase", env });
  }
  const candidate = await repository.findCandidateByCandidateId(input.options.candidateId!);
  if (!candidate) {
    throw new MarketingAssetExportError(`Candidate not found: ${input.options.candidateId}`);
  }
  return renderCardNewsPackage({
    mediaBrief: buildMediaBriefFromCandidate(candidate),
    assetRoot: input.options.root,
    env,
    dryRun: input.options.dryRun,
    graphicOnly: input.options.graphicOnly,
  });
}
