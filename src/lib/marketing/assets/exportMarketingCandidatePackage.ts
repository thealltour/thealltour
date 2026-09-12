import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
import { resolveMarketingAssetRoot, type MarketingAssetEnv } from "@/lib/marketing/assets/config";
import {
  MARKETING_ASSET_EXPORT_CONTEXT_CONTRACT,
  MARKETING_ASSET_MANIFEST_CONTRACT,
  type MarketingAssetArtifact,
  type MarketingAssetManifest,
  type MediaBrief,
} from "@/lib/marketing/assets/contracts";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
import {
  MARKETING_ASSET_GENERATED_DIRECTORIES,
  MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
  MARKETING_ASSET_PUBLISHED_DIRECTORY,
  ensurePackageLayout,
  resolvePackageDirectory,
  resolvePackageRelativePath,
} from "@/lib/marketing/assets/paths";
import {
  assertPackageArtifactWritable,
  describePlannedArtifact,
  overwritePackageArtifact,
  writePackageArtifact,
  type PlannedPackageArtifact,
} from "@/lib/marketing/assets/writeArtifact";
import {
  applyPublishableContentToMediaBrief,
  buildThreadsPostText,
} from "@/lib/marketing/publishable/applyToMediaBrief";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { PUBLISHABLE_CONTENT_MEDIA_TYPE, PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";

export type ExportMarketingCandidatePackageInput = {
  candidate: CompletedMarketingCandidate;
  mediaBrief?: MediaBrief;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
  dryRun?: boolean;
  now?: Date;
  /** Human publishable draft — preferred for Threads when not internal planning. */
  humanDraft?: HumanReviewDraft | null;
  humanEditedAfterGovernance?: boolean;
  /** When true, overwrite post.txt / media-brief / publishable-content if content changed. */
  overwriteArtifacts?: boolean;
  /** Force rebuild of publishable Threads + shortform narration. */
  forcePublishableRegenerate?: boolean;
};

export type ExportMarketingCandidatePackageResult = {
  dryRun: boolean;
  wrote: boolean;
  reused: boolean;
  packageId: string;
  packageRoot: string;
  relativePackagePath: string;
  candidateId: string;
  businessDateKst: string;
  plannedRelativePaths: string[];
  artifacts: MarketingAssetArtifact[];
  manifest: MarketingAssetManifest;
};

function packageIdFor(candidateId: string): string {
  return `map_${candidateId}`;
}

function mediaTypeFor(relativePath: string): string {
  if (relativePath.endsWith(".json")) return "application/json";
  if (relativePath.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (relativePath.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (relativePath.endsWith(".png")) return "image/png";
  if (relativePath.endsWith(".wav")) return "audio/wav";
  if (relativePath.endsWith(".srt")) return "application/x-subrip";
  if (relativePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function buildCopyTextFromPublishable(bundle: PublishableContentBundle): string {
  return buildThreadsPostText(bundle);
}

function planGeneratedArtifacts(input: {
  candidate: CompletedMarketingCandidate;
  mediaBrief: MediaBrief;
  publishable: PublishableContentBundle;
}): PlannedPackageArtifact[] {
  const planned: PlannedPackageArtifact[] = [
    {
      relativePath: "context/export-context.json",
      content: stableJsonBytes(buildExportContext(input.candidate)),
      kind: "context",
      origin: "pipeline_export",
      mediaType: mediaTypeFor("context/export-context.json"),
    },
    {
      relativePath: PUBLISHABLE_CONTENT_RELATIVE_PATH,
      content: stableJsonBytes(input.publishable),
      kind: "context",
      origin: "pipeline_export",
      mediaType: PUBLISHABLE_CONTENT_MEDIA_TYPE,
    },
    {
      relativePath: "context/media-brief.json",
      content: stableJsonBytes(input.mediaBrief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: mediaTypeFor("context/media-brief.json"),
    },
  ];

  const copy = buildCopyTextFromPublishable(input.publishable);
  if (copy.trim()) {
    planned.push({
      relativePath: "copy/post.txt",
      content: Buffer.from(copy, "utf8"),
      kind: "copy",
      origin: "candidate_copy",
      mediaType: mediaTypeFor("copy/post.txt"),
    });
  }

  return planned;
}

function buildExportContext(candidate: CompletedMarketingCandidate) {
  const context = {
    contract: MARKETING_ASSET_EXPORT_CONTEXT_CONTRACT,
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    status: candidate.status,
    selectedAgenda: {
      id: candidate.selectedAgenda.id,
      title: candidate.selectedAgenda.title,
      summary: candidate.selectedAgenda.summary,
      destinations: candidate.selectedAgenda.destinations,
      contentObjective: candidate.selectedAgenda.contentObjective,
    },
    assignment: {
      assignmentId: candidate.contentAssignment.assignmentId,
      objective: candidate.contentAssignment.objective,
      topic: candidate.contentAssignment.topic,
      audience: candidate.contentAssignment.audience,
      commercialIntent: candidate.contentAssignment.commercialIntent,
      facts: candidate.contentAssignment.facts.map((fact) => ({
        factId: fact.factId,
        statement: fact.statement,
        evidenceRefs: fact.evidenceRefs,
        confidence: fact.confidence,
      })),
    },
    contentPlan: candidate.contentPlan
      ? {
          keyMessage: candidate.contentPlan.keyMessage,
          hook: candidate.contentPlan.hook,
          outline: candidate.contentPlan.outline,
          ctaStrategy: candidate.contentPlan.ctaStrategy,
          recommendedFormats: candidate.contentPlan.recommendedFormats.map((item) => ({
            format: item.format,
            score: item.score,
          })),
        }
      : null,
    draft: {
      title: candidate.draft.title ?? null,
      body: candidate.draft.body,
      channel: candidate.draft.channel,
      sourceReferences: candidate.draft.sourceReferences,
    },
    governance: candidate.governanceDecision
      ? {
          decision: candidate.governanceDecision.decision,
          verifiedEvidenceRefs: candidate.governanceDecision.verifiedEvidenceRefs,
          unsupportedClaims: candidate.governanceDecision.unsupportedClaims,
        }
      : null,
  };

  const cleaned = stripForbiddenBotData(context);
  if (jsonContainsForbiddenBotLeak(cleaned)) {
    throw new MarketingAssetContractError("export context contained forbidden secret or embedding fields");
  }
  return cleaned;
}

function integrityDigest(artifacts: MarketingAssetArtifact[]): string {
  const lines = [...artifacts]
    .map((artifact) => `${artifact.relativePath}:${artifact.sha256}`)
    .sort((a, b) => a.localeCompare(b));
  return sha256Buffer(lines.join("\n"));
}

function buildManifest(input: {
  candidate: CompletedMarketingCandidate;
  mediaBrief: MediaBrief;
  artifacts: MarketingAssetArtifact[];
  createdAt: string;
  updatedAt: string;
}): MarketingAssetManifest {
  return parseMarketingAssetManifest({
    contract: MARKETING_ASSET_MANIFEST_CONTRACT,
    packageId: packageIdFor(input.candidate.candidateId),
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    stage: "source",
    mediaBrief: input.mediaBrief,
    artifacts: input.artifacts,
    provenance: {
      exportedFrom: "completed-marketing-candidate",
      candidateContract: input.candidate.contract,
      assignmentId: input.candidate.contentAssignment.assignmentId,
      generatedDirectories: [...MARKETING_ASSET_GENERATED_DIRECTORIES],
      humanEditedDirectory: MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
      publishedDirectory: MARKETING_ASSET_PUBLISHED_DIRECTORY,
    },
    integrity: {
      algorithm: "sha256",
      artifactCount: input.artifacts.length,
      digest: integrityDigest(input.artifacts),
    },
  });
}

function readExistingManifest(packageRoot: string): MarketingAssetManifest | null {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  return parseMarketingAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
}

function artifactsMatch(left: MarketingAssetArtifact[], right: MarketingAssetArtifact[]): boolean {
  if (left.length !== right.length) return false;
  const byPath = new Map(left.map((item) => [item.relativePath, item.sha256]));
  return right.every((item) => byPath.get(item.relativePath) === item.sha256);
}

function assertNoSecretLeak(value: unknown): void {
  if (jsonContainsForbiddenBotLeak(value)) {
    throw new MarketingAssetContractError("marketing asset export refused to write forbidden secret or embedding fields");
  }
}

export function exportMarketingCandidatePackage(
  input: ExportMarketingCandidatePackageInput,
): ExportMarketingCandidatePackageResult {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const assetRoot = resolveMarketingAssetRoot({
    explicitRoot: input.assetRoot,
    env: input.env,
  });
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });

  const publishable = ensurePublishableContentSync({
    candidate: input.candidate,
    packageRoot: existsSync(packageRoot) ? packageRoot : null,
    humanDraft: input.humanDraft,
    humanEditedAfterGovernance: input.humanEditedAfterGovernance,
    forceRegenerate: input.forcePublishableRegenerate,
    now,
  });

  const baseBrief = input.mediaBrief ?? buildMediaBriefFromCandidate(input.candidate);
  const mediaBrief = applyPublishableContentToMediaBrief(baseBrief, publishable);
  assertNoSecretLeak(mediaBrief);
  assertNoSecretLeak(publishable);

  const relativePackagePath = resolvePackageRelativePath({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });
  const planned = planGeneratedArtifacts({
    candidate: input.candidate,
    mediaBrief,
    publishable,
  });
  const plannedArtifacts = planned.map((item) => describePlannedArtifact(item, timestamp));
  const plannedRelativePaths = [...planned.map((item) => item.relativePath), "manifest.json"];
  const existingManifest = input.dryRun ? null : readExistingManifest(packageRoot);
  const createdAt = existingManifest?.createdAt ?? timestamp;
  const manifest = buildManifest({
    candidate: input.candidate,
    mediaBrief,
    artifacts: plannedArtifacts,
    createdAt,
    updatedAt:
      existingManifest && artifactsMatch(existingManifest.artifacts, plannedArtifacts)
        ? existingManifest.updatedAt
        : timestamp,
  });
  assertNoSecretLeak(manifest);

  const resultBase = {
    packageId: manifest.packageId,
    packageRoot,
    relativePackagePath,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    plannedRelativePaths,
    artifacts: plannedArtifacts,
    manifest,
  };

  if (input.dryRun) {
    return {
      ...resultBase,
      dryRun: true,
      wrote: false,
      reused: false,
    };
  }

  if (!input.overwriteArtifacts) {
    for (const item of planned) {
      assertPackageArtifactWritable({ packageRoot, planned: item });
    }
  }

  ensurePackageLayout(packageRoot);

  const writtenArtifacts: MarketingAssetArtifact[] = [];
  for (const item of planned) {
    const createdAtForArtifact =
      existingManifest?.artifacts.find((artifact) => artifact.relativePath === item.relativePath)
        ?.createdAt ?? timestamp;
    if (input.overwriteArtifacts) {
      const written = overwritePackageArtifact({
        packageRoot,
        planned: item,
        createdAt: createdAtForArtifact,
      });
      writtenArtifacts.push(written.artifact);
    } else {
      const written = writePackageArtifact({
        packageRoot,
        planned: item,
        createdAt: createdAtForArtifact,
      });
      writtenArtifacts.push(written.artifact);
    }
  }

  const nextManifest = buildManifest({
    candidate: input.candidate,
    mediaBrief,
    artifacts: writtenArtifacts,
    createdAt,
    updatedAt:
      existingManifest && artifactsMatch(existingManifest.artifacts, writtenArtifacts)
        ? existingManifest.updatedAt
        : timestamp,
  });
  assertNoSecretLeak(nextManifest);

  const identicalRepeat =
    existingManifest != null &&
    artifactsMatch(existingManifest.artifacts, writtenArtifacts) &&
    existingManifest.integrity.digest === nextManifest.integrity.digest;

  if (!identicalRepeat) {
    atomicWriteFile(join(packageRoot, "manifest.json"), stableJsonBytes(nextManifest));
  }

  return {
    ...resultBase,
    dryRun: false,
    wrote: !identicalRepeat,
    reused: identicalRepeat,
    artifacts: writtenArtifacts,
    manifest: identicalRepeat && existingManifest ? existingManifest : nextManifest,
  };
}

export function listImmediatePackageDirectories(packageRoot: string): string[] {
  return readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
