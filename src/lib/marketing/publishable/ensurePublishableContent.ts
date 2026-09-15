/**
 * Idempotent ensure: generate or reuse PublishableContentBundle.
 * MQ-4 canonical PRODUCTION path — async + PublishableLlmInvoke.
 * Never silently overwrite human-edited channel bodies.
 * Deterministic fallback is diagnostic-only (publishableSuccess=false).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  buildPublishableComposerInput,
  computePublishableSourceRevision,
} from "@/lib/marketing/publishable/inputs";
import { stampChannelFromApprovedAsset } from "@/lib/marketing/publishable/approvedAsset";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { composeKakaoChannelPublishableContent } from "@/lib/marketing/publishable/kakao_channel/composeKakaoChannelPublishableContent";
import { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
import { composeNaverBlogPublishableContent } from "@/lib/marketing/publishable/naver_blog/composeNaverBlogPublishableContent";
import { composeShortformNarration } from "@/lib/marketing/publishable/shortform/composeShortformNarration";
import {
  composeThreadsPublishableContent,
  type PublishableLlmInvoke,
} from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  looksLikeInternalPlanningBody,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import {
  attachAssessmentsToPublishableBundle,
  buildMarketingValueBundle,
  evaluateBundleChannels,
  persistMarketingValueBundle,
} from "@/lib/marketing/value";

export type EnsurePublishableContentInput = {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  humanDraft?: HumanReviewDraft | null;
  humanEditedAfterGovernance?: boolean;
  /** Force regenerate AI drafts. */
  forceRegenerate?: boolean;
  /** Channel-scoped regenerate — does not overwrite other human_edited channels. */
  forceRegenerateChannels?: PublishableChannel[];
  allowOverwriteHuman?: boolean;
  invoke?: PublishableLlmInvoke | null;
  modelProfile?: string | null;
  now?: Date;
  /** Durable ACRB — never triggers external research. */
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
  /** Explicit channel selection for human review generation. */
  explicitTargetChannels?: PublishableChannel[] | null;
  /** Persist bundle to packageRoot when generation runs. Default true when packageRoot set. */
  persist?: boolean;
  /**
   * Approved Canonical Marketing Asset override.
   * When candidate carries an unapproved asset, channel generation is blocked (fail closed).
   * Legacy candidates without any asset keep the prior path.
   */
  approvedCanonicalAsset?: CanonicalMarketingAsset | null;
};

function tryReadBundle(packageRoot: string | null | undefined): PublishableContentBundle | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    if (raw?.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) return null;
    if (!raw.threads?.body || !raw.shortform?.body) return null;
    return {
      ...raw,
      targetChannels: raw.targetChannels ?? ["threads", "shortform"],
    };
  } catch {
    return null;
  }
}

function threadsFromHumanDraft(
  candidate: CompletedMarketingCandidate,
  draft: HumanReviewDraft,
  sourceRevision: string,
  nowIso: string,
): PublishableChannelContent {
  const body = stripEvidenceIdsFromText(draft.body);
  const validation = validatePublishableText(body);
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title: draft.title ? stripEvidenceIdsFromText(draft.title) : null,
    body,
    status: "human_edited",
    generatedAt: nowIso,
    sourceCandidateId: candidate.candidateId,
    sourceRevision,
    provenance: {
      composer: "human",
      evidenceRefIds: candidate.contentAssignment.facts.flatMap((f) => f.evidenceRefs).slice(0, 12),
      commercialIntent: candidate.contentAssignment.commercialIntent,
      generationMode: "human",
      attemptCount: 0,
    },
    validation,
    publishableSuccess: validation.ok,
    needsRegeneration: !validation.ok,
  };
}

function shouldRegen(
  channel: PublishableChannel,
  input: EnsurePublishableContentInput,
  existing: PublishableChannelContent | undefined,
): boolean {
  if (existing?.status === "human_edited" && !input.allowOverwriteHuman) return false;
  if (input.forceRegenerateChannels?.includes(channel)) return true;
  if (input.forceRegenerate && !input.forceRegenerateChannels?.length) return true;
  return !existing?.body;
}

export async function ensurePublishableContent(
  input: EnsurePublishableContentInput,
): Promise<PublishableContentBundle> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const acrb = input.audienceContentResearchBrief ?? null;

  const candidateAsset = input.candidate.canonicalMarketingAsset ?? null;
  const approvedAsset =
    input.approvedCanonicalAsset ??
    (isApprovedCanonicalAsset(candidateAsset) ? candidateAsset : null);

  // New path: asset exists but is not approved → fail closed (no channel generation).
  if (candidateAsset && !isApprovedCanonicalAsset(approvedAsset)) {
    const err = new Error("canonical_asset_unapproved");
    (err as Error & { code?: string }).code = "canonical_asset_unapproved";
    throw err;
  }

  const sourceRevision = computePublishableSourceRevision(
    input.candidate,
    input.humanDraft,
    acrb,
    approvedAsset,
  );
  const existing = tryReadBundle(input.packageRoot);
  const composerInput = buildPublishableComposerInput(input.candidate, {
    acrb,
    explicitTargetChannels: input.explicitTargetChannels,
    approvedCanonicalAsset: approvedAsset,
  });
  const targetChannels = composerInput.targetChannels;
  const modelProfile = input.modelProfile ?? "content-strategist";
  const governanceDecision = input.candidate.governanceDecision?.decision ?? null;

  const humanOwnsThreads =
    Boolean(input.humanEditedAfterGovernance) &&
    Boolean(input.humanDraft?.body?.trim()) &&
    !looksLikeInternalPlanningBody(input.humanDraft!.body) &&
    !input.allowOverwriteHuman;

  const scopedOnly = Boolean(input.forceRegenerateChannels?.length);
  if (
    existing &&
    existing.candidateId === input.candidate.candidateId &&
    existing.sourceRevision === sourceRevision &&
    !input.forceRegenerate &&
    !scopedOnly
  ) {
    if (humanOwnsThreads && input.humanDraft) {
      return {
        ...existing,
        targetChannels: existing.targetChannels ?? targetChannels,
        threads: threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso),
        generatedAt: nowIso,
        sourceRevision,
        sourceAssetId: approvedAsset?.assetId ?? existing.sourceAssetId ?? null,
        sourceAssetVersion:
          approvedAsset?.approvedVersion ?? existing.sourceAssetVersion ?? null,
        sourceAssetRevision: approvedAsset?.sourceRevision ?? existing.sourceAssetRevision ?? null,
      };
    }
    return existing;
  }

  // Governance BLOCK — do not polish channel copy for publication.
  const blocked = governanceDecision === "BLOCK";
  const invoke = blocked ? null : input.invoke;
  const composeOpts = {
    composerInput,
    now,
    invoke,
    modelProfile,
    allowDeterministicFallback: true,
  };

  const threads =
    humanOwnsThreads && input.humanDraft
      ? threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso)
      : !shouldRegen("threads", input, existing?.threads) && existing?.threads
        ? existing.threads
        : await composeThreadsPublishableContent(composeOpts);

  const shortform =
    !shouldRegen("shortform", input, existing?.shortform) && existing?.shortform
      ? existing.shortform
      : await composeShortformNarration(composeOpts);

  // Stamp governance block on freshly composed non-human channels
  const stampBlock = (content: PublishableChannelContent): PublishableChannelContent => {
    if (!blocked || content.status === "human_edited") return content;
    return {
      ...content,
      status: "generation_failed",
      publishableSuccess: false,
      needsRegeneration: true,
      provenance: {
        ...content.provenance,
        generationMode: "skipped",
        failureCategory: "governance_block",
        failureMessage: "governance BLOCK — channel composers not invoked",
      },
    };
  };

  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    targetChannels,
    threads: stampBlock(threads),
    shortform: stampBlock(shortform),
    sourceAssetId: approvedAsset?.assetId ?? null,
    sourceAssetVersion: approvedAsset?.approvedVersion ?? null,
    sourceAssetRevision: approvedAsset?.sourceRevision ?? null,
  };

  for (const channel of ["naver_blog", "naver_band", "kakao_channel"] as const) {
    const prev = existing?.[channel];
    if (prev?.status === "human_edited" && !input.allowOverwriteHuman) {
      bundle[channel] = prev;
    }
  }

  if (targetChannels.includes("naver_blog")) {
    bundle.naver_blog =
      !shouldRegen("naver_blog", input, existing?.naver_blog) && existing?.naver_blog
        ? existing.naver_blog
        : stampBlock(await composeNaverBlogPublishableContent(composeOpts));
  }

  if (targetChannels.includes("naver_band")) {
    bundle.naver_band =
      !shouldRegen("naver_band", input, existing?.naver_band) && existing?.naver_band
        ? existing.naver_band
        : stampBlock(await composeNaverBandPublishableContent(composeOpts));
  }

  if (targetChannels.includes("kakao_channel")) {
    bundle.kakao_channel =
      !shouldRegen("kakao_channel", input, existing?.kakao_channel) && existing?.kakao_channel
        ? existing.kakao_channel
        : stampBlock(await composeKakaoChannelPublishableContent(composeOpts));
  }

  if (approvedAsset) {
    bundle.threads = stampChannelFromApprovedAsset(bundle.threads, approvedAsset);
    bundle.shortform = stampChannelFromApprovedAsset(bundle.shortform, approvedAsset);
    if (bundle.naver_blog) {
      bundle.naver_blog = stampChannelFromApprovedAsset(bundle.naver_blog, approvedAsset);
    }
    if (bundle.naver_band) {
      bundle.naver_band = stampChannelFromApprovedAsset(bundle.naver_band, approvedAsset);
    }
    if (bundle.kakao_channel) {
      bundle.kakao_channel = stampChannelFromApprovedAsset(bundle.kakao_channel, approvedAsset);
    }
  }

  // MQ-5 — deterministic Marketing Value Gate (evaluate only; no auto-regeneration).
  const channelsToScore: Array<{
    channel: PublishableChannel;
    content: PublishableChannelContent;
  }> = [
    { channel: "threads", content: bundle.threads },
    { channel: "shortform", content: bundle.shortform },
  ];
  if (bundle.naver_blog) channelsToScore.push({ channel: "naver_blog", content: bundle.naver_blog });
  if (bundle.naver_band) channelsToScore.push({ channel: "naver_band", content: bundle.naver_band });
  if (bundle.kakao_channel) {
    channelsToScore.push({ channel: "kakao_channel", content: bundle.kakao_channel });
  }
  const assessments = evaluateBundleChannels({
    channels: channelsToScore,
    proposition: composerInput.contentProposition,
    researchVerdict: acrb?.researchVerdict ?? null,
    now,
  });
  const scoredBundle = attachAssessmentsToPublishableBundle(bundle, assessments);
  Object.assign(bundle, scoredBundle);

  if (input.packageRoot && input.persist !== false) {
    try {
      if (!existsSync(input.packageRoot)) {
        // package may not exist yet — export creates it; skip persist here
      } else {
        persistPublishableContentBundle({
          packageRoot: input.packageRoot,
          bundle,
          createdAt: nowIso,
        });
        persistMarketingValueBundle({
          packageRoot: input.packageRoot,
          bundle: buildMarketingValueBundle({
            candidateId: input.candidate.candidateId,
            sourceRevision,
            channels: assessments,
            now,
          }),
          createdAt: nowIso,
        });
      }
    } catch {
      /* best-effort persist */
    }
  }

  return bundle;
}
