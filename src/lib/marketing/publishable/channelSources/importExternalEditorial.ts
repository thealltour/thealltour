/**
 * Import: strict parse → per-channel dry-run materialization → immutable candidate write.
 * Research integrity failures reject the import; channel copy failures only mark that channel
 * non-selectable (operator decision, see channelReadiness).
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT } from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import {
  EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
  EXTERNAL_EDITORIAL_PROVIDER,
  type ExternalEditorialCandidate,
  type ExternalEditorialChannelReadiness,
} from "@/lib/marketing/publishable/channelSources/contracts";
import {
  buildExternalImportId,
  persistExternalEditorialCandidate,
} from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import { buildExternalNarrativeFingerprint } from "@/lib/marketing/publishable/channelSources/externalNarrative";
import {
  ExternalChannelMaterializeError,
  externalChannelArtifact,
  materializeExternalChannel,
  type ExternalMaterializeContext,
} from "@/lib/marketing/publishable/channelSources/materializeExternalChannel";
import {
  parseExternalEditorialResult,
  type ExternalEditorialParseErrorCode,
} from "@/lib/marketing/publishable/channelSources/parseExternalEditorialResult";
import { externalEditorialCandidateRelativePath } from "@/lib/marketing/publishable/channelSources/paths";
import { PUBLISHABLE_CHANNELS, type PublishableChannel } from "@/lib/marketing/publishable/contracts";

export type ImportExternalEditorialResult =
  | { ok: true; candidate: ExternalEditorialCandidate; candidateRef: string }
  | { ok: false; code: ExternalEditorialParseErrorCode; messageKo: string; details: string[] };

export function computeExternalChannelReadiness(input: {
  candidateId: string;
  asset: CanonicalMarketingAsset;
  result: Record<string, unknown>;
  externalNarrativeFingerprint: string;
  externalCandidateRef: string;
  canonicalEvidenceIds: readonly string[];
  nowIso: string;
}): { readiness: Record<PublishableChannel, ExternalEditorialChannelReadiness>; warnings: string[] } {
  const readiness = {} as Record<PublishableChannel, ExternalEditorialChannelReadiness>;
  const warnings: string[] = [];
  for (const channel of PUBLISHABLE_CHANNELS) {
    if (externalChannelArtifact(input.result, channel) === null) {
      readiness[channel] = { present: false, materializable: false, issues: [] };
      continue;
    }
    const ctx: ExternalMaterializeContext = {
      candidateId: input.candidateId,
      asset: input.asset,
      result: input.result,
      externalNarrativeFingerprint: input.externalNarrativeFingerprint,
      externalCandidateRef: input.externalCandidateRef,
      canonicalEvidenceIds: input.canonicalEvidenceIds,
      bundleSourceRevision: "import_dry_run",
      priorSlot: null,
      nowIso: input.nowIso,
      narrativeGeneratedAt: input.nowIso,
    };
    try {
      const out = materializeExternalChannel(ctx, channel);
      readiness[channel] = { present: true, materializable: true, issues: [] };
      warnings.push(...out.warnings);
    } catch (error) {
      const issue =
        error instanceof ExternalChannelMaterializeError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      readiness[channel] = { present: true, materializable: false, issues: [issue] };
    }
  }
  return { readiness, warnings };
}

export function importExternalEditorialResult(input: {
  packageRoot: string;
  candidateId: string;
  approvedCanonical: CanonicalMarketingAsset | null;
  raw: string;
  importedBy: string | null;
  now?: Date;
}): ImportExternalEditorialResult {
  const parsed = parseExternalEditorialResult({
    raw: input.raw,
    candidateId: input.candidateId,
    approvedCanonical: input.approvedCanonical,
  });
  if (!parsed.ok) return parsed;

  const asset = input.approvedCanonical!;
  const now = input.now ?? new Date();
  const importedAt = now.toISOString();
  const importId = buildExternalImportId(input.raw, now);
  const candidateRef = externalEditorialCandidateRelativePath(importId);
  const externalNarrativeFingerprint = buildExternalNarrativeFingerprint({
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
    narrative: parsed.value.result.narrative,
  });
  const { readiness, warnings } = computeExternalChannelReadiness({
    candidateId: input.candidateId,
    asset,
    result: parsed.value.result,
    externalNarrativeFingerprint,
    externalCandidateRef: candidateRef,
    canonicalEvidenceIds: parsed.value.canonicalEvidenceIds,
    nowIso: importedAt,
  });

  const candidate: ExternalEditorialCandidate = {
    contract: EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
    importId,
    provider: EXTERNAL_EDITORIAL_PROVIDER,
    importedAt,
    importedBy: input.importedBy,
    resultContract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
    externalNarrativeFingerprint,
    warnings: [...parsed.value.warnings, ...warnings],
    channelReadiness: readiness,
    result: parsed.value.result,
  };
  const writtenRef = persistExternalEditorialCandidate({ packageRoot: input.packageRoot, candidate });
  return { ok: true, candidate, candidateRef: writtenRef };
}
