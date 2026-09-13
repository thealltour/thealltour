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
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";
import { PUBLISHABLE_CONTENT_MEDIA_TYPE, PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import type { PublishableChannelContent, PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  MARKETING_VALUE_MEDIA_TYPE,
  MARKETING_VALUE_RELATIVE_PATH,
} from "@/lib/marketing/value/paths";
import {
  buildMarketingValueBundle,
  tryReadMarketingValueBundle,
} from "@/lib/marketing/value/persist";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import type { MarketingValueAssessment } from "@/lib/marketing/value/contracts";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_MEDIA_TYPE,
  AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH,
} from "@/lib/marketing/audienceResearch/paths";
import { toAudienceContentResearchBriefRef } from "@/lib/marketing/audienceResearch/validate";

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
  /**
   * Deprecated for production LLM regen — export must not invoke composers.
   * When true with no pre-built bundle, sync may only reuse persisted artifacts
   * (allowDeterministicGeneration=false). Prefer `publishableBundle`.
   */
  forcePublishableRegenerate?: boolean;
  /** MQ-4 — pre-generated LLM publishable bundle (canonical). Export does not call LLM. */
  publishableBundle?: PublishableContentBundle | null;
  /** RA-1B — full ACRB for package artifact (optional if only compact ref on candidate). */
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
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
  if (!channelCountsAsPublishableSuccess(bundle.threads) && bundle.threads.status !== "human_edited") {
    const reason =
      bundle.threads.provenance?.failureMessage ??
      bundle.threads.status ??
      "not_publishable";
    return `[DEGRADED — not final publishable copy]\nstatus=${bundle.threads.status}\ncomposer=${bundle.threads.provenance.composer}\nreason=${reason}\n\n${buildThreadsPostText(bundle)}`;
  }
  return buildThreadsPostText(bundle);
}

function pushChannelCopyIfPublishable(
  planned: PlannedPackageArtifact[],
  relativePath: string,
  content: PublishableChannelContent | undefined,
): void {
  if (!content?.body?.trim()) return;
  if (channelCountsAsPublishableSuccess(content) || content.status === "human_edited") {
    pushCopyArtifact(planned, relativePath, content.body);
    return;
  }
  // Diagnostic only — clearly marked in-body, not masquerading as final.
  pushCopyArtifact(
    planned,
    relativePath,
    `[DEGRADED — ${content.status} / ${content.provenance.composer} — not final publishable copy]\n${content.body}`,
  );
}

function pushCopyArtifact(
  planned: PlannedPackageArtifact[],
  relativePath: string,
  text: string,
): void {
  if (!text.trim()) return;
  planned.push({
    relativePath,
    content: Buffer.from(text.endsWith("\n") ? text : `${text}\n`, "utf8"),
    kind: "copy",
    origin: "candidate_copy",
    mediaType: mediaTypeFor(relativePath),
  });
}

function planGeneratedArtifacts(input: {
  candidate: CompletedMarketingCandidate;
  mediaBrief: MediaBrief;
  publishable: PublishableContentBundle;
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
  packageRoot?: string | null;
}): PlannedPackageArtifact[] {
  const planned: PlannedPackageArtifact[] = [
    {
      relativePath: "context/export-context.json",
      content: stableJsonBytes(buildExportContext(input.candidate, input.audienceContentResearchBrief)),
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

  if (input.audienceContentResearchBrief) {
    planned.push({
      relativePath: AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH,
      content: stableJsonBytes(input.audienceContentResearchBrief),
      kind: "context",
      origin: "pipeline_export",
      mediaType: AUDIENCE_CONTENT_RESEARCH_BRIEF_MEDIA_TYPE,
    });
  }

  // MQ-5 — persist assessment metadata; never recompute scores on export.
  const fromPublishable: Partial<Record<PublishableChannel, MarketingValueAssessment>> = {};
  for (const channel of ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"] as const) {
    const slot = input.publishable[channel];
    if (slot?.marketingValue) fromPublishable[channel] = slot.marketingValue;
  }
  const existingValue = tryReadMarketingValueBundle(input.packageRoot ?? null);
  const valueChannels = { ...(existingValue?.channels ?? {}), ...fromPublishable };
  if (Object.keys(valueChannels).length > 0) {
    planned.push({
      relativePath: MARKETING_VALUE_RELATIVE_PATH,
      content: stableJsonBytes(
        buildMarketingValueBundle({
          candidateId: input.candidate.candidateId,
          sourceRevision: input.publishable.sourceRevision,
          channels: valueChannels,
        }),
      ),
      kind: "context",
      origin: "pipeline_export",
      mediaType: MARKETING_VALUE_MEDIA_TYPE,
    });
  }

  const copy = buildCopyTextFromPublishable(input.publishable);
  pushCopyArtifact(planned, "copy/post.txt", copy);

  // CG-4B — only emit artifacts for channels actually generated.
  pushChannelCopyIfPublishable(planned, "copy/naver-blog.md", input.publishable.naver_blog);
  pushChannelCopyIfPublishable(planned, "copy/naver-band.txt", input.publishable.naver_band);
  pushChannelCopyIfPublishable(planned, "copy/kakao-channel.txt", input.publishable.kakao_channel);

  return planned;
}

function buildExportContext(
  candidate: CompletedMarketingCandidate,
  audienceContentResearchBrief?: AudienceContentResearchBrief | null,
) {
  const acrbRef =
    audienceContentResearchBrief
      ? toAudienceContentResearchBriefRef(audienceContentResearchBrief)
      : candidate.audienceContentResearchRef ?? null;
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
          targetChannels: candidate.contentPlan.targetChannels ?? null,
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
    audienceContentResearch: acrbRef,
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

  const publishable =
    input.publishableBundle ??
    ensurePublishableContentSync({
      candidate: input.candidate,
      packageRoot: existsSync(packageRoot) ? packageRoot : null,
      humanDraft: input.humanDraft,
      humanEditedAfterGovernance: input.humanEditedAfterGovernance,
      // MQ-4: never invent deterministic "publishable" on export — reuse persisted only.
      forceRegenerate: false,
      allowDeterministicGeneration: false,
      now,
      audienceContentResearchBrief: input.audienceContentResearchBrief ?? null,
    });
  void input.forcePublishableRegenerate;

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
    audienceContentResearchBrief: input.audienceContentResearchBrief ?? null,
    packageRoot,
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
