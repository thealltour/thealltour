import "server-only";

import {
  runExportMarketingCandidateAssetsCommand,
  type ExportMarketingCandidatePackageResult,
} from "@/lib/marketing/assets/exportCommand";
import {
  inspectMarketingAssetPackage,
  readMarketingAssetPackageFile,
  type MarketingAssetPackageFileRead,
  type MarketingAssetPackageInspection,
} from "@/lib/marketing/assets/inspectMarketingAssetPackage";
import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import {
  createDailyMarketingRunRepository,
  type DailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

async function resolveCandidateRepo(
  repository?: DailyMarketingRunRepository,
): Promise<DailyMarketingRunRepository> {
  return (
    repository ??
    (await createDailyMarketingRunRepository(
      process.env.VITEST || process.env.NODE_ENV === "test" ? { backend: "memory" } : {},
    ))
  );
}

export async function loadCompletedMarketingCandidateForAssets(
  candidateId: string,
  repository?: DailyMarketingRunRepository,
): Promise<CompletedMarketingCandidate | null> {
  const repo = await resolveCandidateRepo(repository);
  return repo.findCandidateByCandidateId(candidateId);
}

export async function inspectCandidateAssetPackage(input: {
  candidateId: string;
  repository?: DailyMarketingRunRepository;
}): Promise<
  | { ok: true; candidate: CompletedMarketingCandidate; inspection: MarketingAssetPackageInspection }
  | { ok: false; reason: "candidate_not_found" }
> {
  const candidate = await loadCompletedMarketingCandidateForAssets(
    input.candidateId,
    input.repository,
  );
  if (!candidate) return { ok: false, reason: "candidate_not_found" };
  const inspection = inspectMarketingAssetPackage({
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
  });
  return { ok: true, candidate, inspection };
}

export async function exportCandidateAssetPackage(input: {
  candidateId: string;
  dryRun?: boolean;
  repository?: DailyMarketingRunRepository;
}): Promise<
  | { ok: true; result: ExportMarketingCandidatePackageResult }
  | { ok: false; reason: "candidate_not_found" }
> {
  const candidate = await loadCompletedMarketingCandidateForAssets(
    input.candidateId,
    input.repository,
  );
  if (!candidate) return { ok: false, reason: "candidate_not_found" };

  try {
    const result = await runExportMarketingCandidateAssetsCommand({
      options: {
        candidateId: candidate.candidateId,
        dryRun: Boolean(input.dryRun),
      },
      repository: input.repository ?? (await resolveCandidateRepo()),
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof MarketingAssetExportError && /not found/i.test(error.message)) {
      return { ok: false, reason: "candidate_not_found" };
    }
    throw error;
  }
}

export async function readCandidateAssetPackageFile(input: {
  candidateId: string;
  relativePath: string;
  repository?: DailyMarketingRunRepository;
}): Promise<
  | { ok: true; file: MarketingAssetPackageFileRead }
  | { ok: false; reason: "candidate_not_found" }
> {
  const candidate = await loadCompletedMarketingCandidateForAssets(
    input.candidateId,
    input.repository,
  );
  if (!candidate) return { ok: false, reason: "candidate_not_found" };
  const file = readMarketingAssetPackageFile({
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    relativePath: input.relativePath,
  });
  return { ok: true, file };
}
