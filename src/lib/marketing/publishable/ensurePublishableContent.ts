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
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  formatForChannel,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  buildPublishableComposerInput,
  computePublishableSourceRevision,
} from "@/lib/marketing/publishable/inputs";
import { stampChannelFromApprovedAsset } from "@/lib/marketing/publishable/approvedAsset";
import { createNotGeneratedChannelContent } from "@/lib/marketing/publishable/channelWorkspace";
import { resolveChannelEditorHermesProfile } from "@/lib/marketing/publishable/channelEditorIdentity";
import { CHANNEL_INPUT_AUTHORITY_VERSION } from "@/lib/marketing/publishable/composerRuntime";
import {
  evaluateScopedRegenerationFreshness,
  markStaleScopedRegeneration,
  mergeForceRegenerateQualityRevision,
  publishableBodiesEqual,
} from "@/lib/marketing/publishable/channelRegenerationFreshness";
import { ensureEditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan";
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  buildCoreContentPack,
  resolveCoreGateDecision,
} from "@/lib/marketing/publishable/core/coreContentPack";
import { persistCoreContentPack } from "@/lib/marketing/publishable/core/persistCoreContentPack";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import {
  resolvePublishableComposerConcurrency,
  runWithConcurrency,
} from "@/lib/marketing/publishable/composeConcurrency";
import { composeInstagramPublishableContent } from "@/lib/marketing/publishable/instagram/composeInstagramPublishableContent";
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
  /**
   * When false, composers must not invent diagnostic “관측됨” fallback bodies.
   * Defaults to false for channel-scoped regenerate; true otherwise.
   */
  allowDeterministicFallback?: boolean;
  /**
   * When false, Instagram uses legacy single-shot channel-editor-instagram path.
   * Default true for production ensure (packageRoot present). Unit tests that mock
   * a single Instagram JSON blob should set false.
   */
  useInstagramEditorialSplit?: boolean;
  /**
   * When false, Threads uses legacy single-shot channel-editor-threads path.
   * Default true for production ensure (packageRoot present).
   */
  useThreadsCopySpecialist?: boolean;
  /**
   * When false, Naver Blog uses legacy single-shot channel-editor-naver-blog path.
   * Default true for production ensure (packageRoot present).
   */
  useNaverBlogEditorialSplit?: boolean;
  /** Prefer Naver Band Copy Specialist when packageRoot + Narrative are present. */
  useNaverBandCopySpecialist?: boolean;
  /** Marketing Value / human review quality repair hints for Content Strategist composer. */
  qualityRevision?: {
    hints: string[];
    priorBody?: string | null;
    reasons?: string[];
  } | null;
};

function tryReadBundle(packageRoot: string | null | undefined): PublishableContentBundle | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    if (raw?.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) return null;
    // Baseline slots may be not_generated (empty body) after Canonical approve-only.
    if (!raw.threads || !raw.shortform) return null;
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
  // Channel-scoped regenerate: only listed channels hit the LLM.
  if (input.forceRegenerateChannels?.length) {
    return input.forceRegenerateChannels.includes(channel);
  }
  if (input.forceRegenerate) return true;
  return !existing?.body;
}

export async function ensurePublishableContent(
  input: EnsurePublishableContentInput,
): Promise<PublishableContentBundle> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const acrb = input.audienceContentResearchBrief ?? null;

  const packageAsset = readCanonicalAssetFromPackage(input.packageRoot ?? null);
  const candidateAsset = input.candidate.canonicalMarketingAsset ?? null;
  const approvedAsset =
    input.approvedCanonicalAsset ??
    (isApprovedCanonicalAsset(packageAsset) ? packageAsset : null) ??
    (isApprovedCanonicalAsset(candidateAsset) ? candidateAsset : null);

  // Asset present but not approved → fail closed (no channel generation).
  const knownAsset = packageAsset ?? candidateAsset;
  if (knownAsset && !isApprovedCanonicalAsset(approvedAsset)) {
    const err = new Error("canonical_asset_unapproved");
    (err as Error & { code?: string }).code = "canonical_asset_unapproved";
    throw err;
  }

  const existing = tryReadBundle(input.packageRoot);
  const baseComposerInput = {
    ...buildPublishableComposerInput(input.candidate, {
      acrb,
      explicitTargetChannels: input.explicitTargetChannels,
      approvedCanonicalAsset: approvedAsset,
      packageRoot: input.packageRoot ?? null,
    }),
    ...(input.qualityRevision
      ? {
          qualityRevision: {
            hints: input.qualityRevision.hints.slice(0, 8),
            priorBody: input.qualityRevision.priorBody ?? null,
            reasons: input.qualityRevision.reasons?.slice(0, 6),
          },
        }
      : {}),
  };
  const corePack = buildCoreContentPack({ composerInput: baseComposerInput, now });
  const governanceDecision = input.candidate.governanceDecision?.decision ?? null;
  const blockedEarly = governanceDecision === "BLOCK";
  const narrativeInvoke = blockedEarly ? null : (input.invoke ?? null);

  let editorialNarrativePlan = baseComposerInput.editorialNarrativePlan ?? null;
  if (approvedAsset && (narrativeInvoke || input.packageRoot)) {
    const ensured = await ensureEditorialNarrativePlan({
      composerInput: { ...baseComposerInput, corePack },
      invoke: narrativeInvoke,
      packageRoot: input.packageRoot ?? null,
      now,
      forceRegenerate: Boolean(input.forceRegenerate) && !input.forceRegenerateChannels?.length,
    });
    editorialNarrativePlan = ensured.plan;
  }

  const narrativeContentFingerprint = editorialNarrativePlan
    ? buildEditorialNarrativeContentFingerprint(editorialNarrativePlan)
    : null;
  const sourceRevision = computePublishableSourceRevision(
    input.candidate,
    input.humanDraft,
    acrb,
    approvedAsset,
    narrativeContentFingerprint,
  );
  const composerInput = {
    ...baseComposerInput,
    corePack,
    editorialNarrativePlan,
    sourceRevision,
  };
  const targetChannels = composerInput.targetChannels;
  const modelProfileFor = (channel: PublishableChannel) =>
    input.modelProfile ?? resolveChannelEditorHermesProfile(channel);

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
  const blocked = blockedEarly;
  const invoke = blocked ? null : input.invoke;
  const allowDeterministicFallback =
    input.allowDeterministicFallback ?? !scopedOnly;
  const composeOptsFor = (
    channel: PublishableChannel,
    options?: { identicalBodyRetry?: boolean },
  ) => {
    // Scoped channel regenerate must never reuse specialist package artifacts.
    const forceRegenerate = input.forceRegenerateChannels?.length
      ? input.forceRegenerateChannels.includes(channel)
      : Boolean(input.forceRegenerate);
    const prior = existing?.[channel];
    const regenerationNonce = `${channel}:${nowIso}${
      options?.identicalBodyRetry ? ":retry" : ""
    }`;
    let channelComposerInput = composerInput;
    if (forceRegenerate) {
      const mergedQr = mergeForceRegenerateQualityRevision({
        existing: composerInput.qualityRevision,
        priorBody: prior?.body?.trim() ? prior.body : null,
        regenerationNonce,
      });
      if (options?.identicalBodyRetry) {
        mergedQr.hints = [
          "CRITICAL: previous regenerate returned an identical body. Rewrite with substantially different wording and structure.",
          ...mergedQr.hints,
        ].slice(0, 8);
        mergedQr.reasons = ["regeneration_body_unchanged", ...mergedQr.reasons].slice(0, 6);
      }
      channelComposerInput = {
        ...composerInput,
        qualityRevision: mergedQr,
      };
    }
    return {
      composerInput: channelComposerInput,
      now,
      invoke,
      modelProfile: modelProfileFor(channel),
      allowDeterministicFallback,
      forceRegenerate,
      ...(channel === "instagram"
        ? {
            useEditorialSplit: input.useInstagramEditorialSplit !== false,
            packageRoot: input.packageRoot ?? null,
          }
        : {}),
      ...(channel === "threads"
        ? {
            useThreadsCopySpecialist: input.useThreadsCopySpecialist !== false,
            packageRoot: input.packageRoot ?? null,
          }
        : {}),
      ...(channel === "naver_blog"
        ? {
            useNaverBlogEditorialSplit: input.useNaverBlogEditorialSplit !== false,
            packageRoot: input.packageRoot ?? null,
          }
        : {}),
      ...(channel === "naver_band"
        ? {
            useNaverBandCopySpecialist: input.useNaverBandCopySpecialist !== false,
            packageRoot: input.packageRoot ?? null,
          }
        : {}),
    };
  };

  /**
   * Core fact gate. A scoped regenerate is an explicit operator request, so it
   * bypasses the gate — silently refusing there would look like a broken button.
   */
  const coreGate = scopedOnly
    ? null
    : resolveCoreGateDecision({ pack: corePack, targetChannels });
  const coreGateBlocks = (channel: PublishableChannel): boolean =>
    Boolean(coreGate?.blockedChannels.includes(channel));

  const isScopedLlmSuccess = (
    content: PublishableChannelContent,
    previous?: PublishableChannelContent,
  ): boolean => {
    if (content.provenance.composer !== "llm" || content.publishableSuccess !== true) {
      return false;
    }
    return evaluateScopedRegenerationFreshness({ prior: previous, next: content }).ok;
  };

  /** Persist prior artifact when scoped regenerate fails (never write diagnostic fallback). */
  const channelForPersist = (
    channel: PublishableChannel,
    composed: PublishableChannelContent,
    previous: PublishableChannelContent | undefined,
  ): PublishableChannelContent => {
    if (!input.forceRegenerateChannels?.includes(channel)) return composed;
    if (isScopedLlmSuccess(composed, previous)) return composed;
    if (previous?.body?.trim()) return previous;
    return composed;
  };

  /** Skipped channel placeholder — records why, never a fabricated body. */
  const coreGateSkipped = (channel: PublishableChannel): PublishableChannelContent => ({
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format: formatForChannel(channel),
    title: null,
    body: "",
    status: "generation_failed",
    generatedAt: nowIso,
    sourceCandidateId: input.candidate.candidateId,
    sourceRevision,
    provenance: {
      composer: "deterministic_fallback",
      evidenceRefIds: [],
      commercialIntent: input.candidate.contentAssignment.commercialIntent,
      generationMode: "skipped",
      modelProfile: null,
      attemptCount: 0,
      failureCategory: "core_facts_insufficient",
      failureMessage: coreGate?.reason ?? "core_facts_insufficient",
    },
    validation: { ok: false, issues: [{ code: "empty_body", message: "core fact gate skipped generation" }] },
    publishableSuccess: false,
    needsRegeneration: true,
  });

  // Stamp governance block + approved-asset authority markers on freshly composed channels
  const stampBlock = (content: PublishableChannelContent): PublishableChannelContent => {
    let next = content;
    if (blocked && content.status !== "human_edited") {
      next = {
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
    }
    return {
      ...next,
      provenance: {
        ...next.provenance,
        compositionMode: composerInput.compositionMode ?? null,
        inputAuthorityVersion: CHANNEL_INPUT_AUTHORITY_VERSION,
      },
    };
  };

  type ComposeOpts = ReturnType<typeof composeOptsFor>;
  const composerFor: Record<
    PublishableChannel,
    (opts: ComposeOpts) => Promise<PublishableChannelContent>
  > = {
    threads: composeThreadsPublishableContent,
    shortform: composeShortformNarration,
    naver_blog: composeNaverBlogPublishableContent,
    naver_band: composeNaverBandPublishableContent,
    kakao_channel: composeKakaoChannelPublishableContent,
    instagram: composeInstagramPublishableContent,
  };

  /**
   * Reuse / gate decisions are cheap and deterministic, so they resolve up front;
   * only channels that actually need a model call become tasks. That keeps the
   * concurrency budget spent on Hermes calls rather than on bookkeeping.
   */
  const resolvedChannels = new Map<PublishableChannel, PublishableChannelContent>();
  const composeTasks: Array<{ channel: PublishableChannel; run: () => Promise<PublishableChannelContent> }> =
    [];

  const planChannel = (channel: PublishableChannel): void => {
    const prior = existing?.[channel];
    if (!shouldRegen(channel, input, prior)) {
      if (prior) {
        resolvedChannels.set(channel, prior);
        return;
      }
      // Scoped generate must not invent sibling channel bodies.
      if (scopedOnly) {
        resolvedChannels.set(
          channel,
          createNotGeneratedChannelContent({
            channel,
            candidateId: input.candidate.candidateId,
            sourceRevision,
            nowIso,
            commercialIntent: input.candidate.contentAssignment.commercialIntent,
          }),
        );
        return;
      }
      composeTasks.push({
        channel,
        run: () => composerFor[channel](composeOptsFor(channel)),
      });
      return;
    }
    if (coreGateBlocks(channel)) {
      resolvedChannels.set(channel, coreGateSkipped(channel));
      return;
    }
    composeTasks.push({ channel, run: () => composerFor[channel](composeOptsFor(channel)) });
  };

  if (humanOwnsThreads && input.humanDraft) {
    resolvedChannels.set(
      "threads",
      threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso),
    );
  } else {
    planChannel("threads");
  }
  planChannel("shortform");

  const optionalChannels = ["naver_blog", "naver_band", "kakao_channel", "instagram"] as const;
  const humanOwned = new Set<PublishableChannel>();
  for (const channel of optionalChannels) {
    const prev = existing?.[channel];
    if (prev?.status === "human_edited" && !input.allowOverwriteHuman) {
      humanOwned.add(channel);
      resolvedChannels.set(channel, prev);
      continue;
    }
    if (targetChannels.includes(channel)) {
      planChannel(channel);
      continue;
    }
    // Preserve previously generated optional siblings even when the current
    // contentPlan/targetChannels omit them (e.g. Threads regenerate must not
    // wipe an existing Instagram slot from publishable-content.json).
    if (prev && prev.status !== "not_generated") {
      resolvedChannels.set(channel, prev);
    }
  }

  const composed = await runWithConcurrency(
    composeTasks.map((task) => task.run),
    resolvePublishableComposerConcurrency(),
  );
  const freshlyComposed = new Set<PublishableChannel>();
  for (const [index, task] of composeTasks.entries()) {
    let next = composed[index]!;
    const channel = task.channel;
    const previous = existing?.[channel];
    const forced = Boolean(input.forceRegenerateChannels?.includes(channel));

    // Soft-reuse: one bounded retry when LLM returned an identical prior body.
    if (
      forced &&
      previous?.body?.trim() &&
      next.provenance.composer === "llm" &&
      next.publishableSuccess === true &&
      (next.provenance.attemptCount ?? 0) >= 1 &&
      publishableBodiesEqual(previous.body, next.body)
    ) {
      next = await composerFor[channel](composeOptsFor(channel, { identicalBodyRetry: true }));
    }

    if (forced) {
      const freshness = evaluateScopedRegenerationFreshness({ prior: previous, next });
      if (!freshness.ok) {
        next = markStaleScopedRegeneration({
          content: next,
          failureMessage: freshness.failureMessage,
        });
      }
    }

    resolvedChannels.set(channel, next);
    freshlyComposed.add(channel);
  }

  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    targetChannels,
    // threads/shortform are stamped even when reused, matching the pre-fan-out contract.
    threads: stampBlock(resolvedChannels.get("threads")!),
    shortform: stampBlock(resolvedChannels.get("shortform")!),
    sourceAssetId: approvedAsset?.assetId ?? null,
    sourceAssetVersion: approvedAsset?.approvedVersion ?? null,
    sourceAssetRevision: approvedAsset?.sourceRevision ?? null,
  };

  for (const channel of optionalChannels) {
    const content = resolvedChannels.get(channel);
    if (!content) continue;
    bundle[channel] =
      freshlyComposed.has(channel) && !humanOwned.has(channel) ? stampBlock(content) : content;
  }

  // Persist targetChannels must reflect every optional slot that actually has content,
  // so subsequent scoped regenerates keep planning/preserving Instagram etc.
  const persistedTargets = new Set<PublishableChannel>(targetChannels);
  for (const channel of optionalChannels) {
    const slot = bundle[channel];
    if (slot && slot.status !== "not_generated" && (slot.body?.trim() || slot.instagramMeta?.cardPlan?.length)) {
      persistedTargets.add(channel);
    }
  }
  bundle.targetChannels = [...persistedTargets];

  if (approvedAsset) {
    const approvedVersion = approvedAsset.approvedVersion ?? approvedAsset.version;
    const applyAuthority = (channel: PublishableChannel, content: PublishableChannelContent) => {
      if (freshlyComposed.has(channel)) {
        return stampChannelFromApprovedAsset(content, approvedAsset);
      }
      if (content.status === "not_generated" || !content.body?.trim()) {
        return {
          ...content,
          sourceAssetId: null,
          sourceAssetVersion: null,
          stale: false,
        };
      }
      const same =
        content.sourceAssetId === approvedAsset.assetId &&
        content.sourceAssetVersion === approvedVersion;
      return { ...content, stale: !same };
    };
    bundle.threads = applyAuthority("threads", bundle.threads);
    bundle.shortform = applyAuthority("shortform", bundle.shortform);
    if (bundle.naver_blog) {
      bundle.naver_blog = applyAuthority("naver_blog", bundle.naver_blog);
    }
    if (bundle.naver_band) {
      bundle.naver_band = applyAuthority("naver_band", bundle.naver_band);
    }
    if (bundle.kakao_channel) {
      bundle.kakao_channel = applyAuthority("kakao_channel", bundle.kakao_channel);
    }
    if (bundle.instagram) {
      bundle.instagram = applyAuthority("instagram", bundle.instagram);
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
  if (bundle.instagram) channelsToScore.push({ channel: "instagram", content: bundle.instagram });
  const assessments = evaluateBundleChannels({
    channels: channelsToScore.filter(
      (row) => row.content.status !== "not_generated" && Boolean(row.content.body?.trim()),
    ),
    proposition: composerInput.contentProposition,
    researchVerdict: acrb?.researchVerdict ?? null,
    usableFacts: composerInput.usableFacts.map((f) => f.statement),
    editorialArchetype:
      composerInput.storyLock?.editorialArchetype ??
      composerInput.approvedCanonicalAsset?.editorialArchetype ??
      null,
    now,
  });
  const scoredBundle = attachAssessmentsToPublishableBundle(bundle, assessments);
  Object.assign(bundle, scoredBundle);

  if (input.packageRoot && input.persist !== false) {
    try {
      if (!existsSync(input.packageRoot)) {
        // package may not exist yet — export creates it; skip persist here
      } else {
        const persistBundle: PublishableContentBundle = {
          ...bundle,
          threads: channelForPersist("threads", bundle.threads, existing?.threads),
          shortform: channelForPersist("shortform", bundle.shortform, existing?.shortform),
          naver_blog: bundle.naver_blog
            ? channelForPersist("naver_blog", bundle.naver_blog, existing?.naver_blog)
            : existing?.naver_blog,
          naver_band: bundle.naver_band
            ? channelForPersist("naver_band", bundle.naver_band, existing?.naver_band)
            : existing?.naver_band,
          kakao_channel: bundle.kakao_channel
            ? channelForPersist("kakao_channel", bundle.kakao_channel, existing?.kakao_channel)
            : existing?.kakao_channel,
          // Critical: omit → undefined previously wiped Instagram from disk when
          // Threads/Blog regenerate ran without instagram in targetChannels.
          instagram: bundle.instagram
            ? channelForPersist("instagram", bundle.instagram, existing?.instagram)
            : existing?.instagram,
        };
        // Recompute targetChannels after optional carry-forward from existing.
        const persistTargets = new Set<PublishableChannel>(persistBundle.targetChannels ?? []);
        for (const channel of ["naver_blog", "naver_band", "kakao_channel", "instagram"] as const) {
          const slot = persistBundle[channel];
          if (
            slot &&
            slot.status !== "not_generated" &&
            (slot.body?.trim() || (slot.instagramMeta?.cardPlan?.length ?? 0) > 0)
          ) {
            persistTargets.add(channel);
          }
        }
        persistBundle.targetChannels = [...persistTargets];
        persistPublishableContentBundle({
          packageRoot: input.packageRoot,
          bundle: persistBundle,
          createdAt: nowIso,
        });
        persistCoreContentPack({
          packageRoot: input.packageRoot,
          pack: corePack,
          createdAt: nowIso,
        });
        const scopedFailed =
          scopedOnly &&
          (input.forceRegenerateChannels ?? []).every((channel) => {
            const slot =
              channel === "threads"
                ? bundle.threads
                : channel === "shortform"
                  ? bundle.shortform
                  : channel === "naver_blog"
                    ? bundle.naver_blog
                    : channel === "naver_band"
                      ? bundle.naver_band
                      : channel === "instagram"
                        ? bundle.instagram
                        : bundle.kakao_channel;
            const previous =
              channel === "threads"
                ? existing?.threads
                : channel === "shortform"
                  ? existing?.shortform
                  : channel === "naver_blog"
                    ? existing?.naver_blog
                    : channel === "naver_band"
                      ? existing?.naver_band
                      : channel === "instagram"
                        ? existing?.instagram
                        : existing?.kakao_channel;
            return !slot || !isScopedLlmSuccess(slot, previous);
          });
        // Do not clobber prior Marketing Value scores with empty/failure assessments.
        if (!scopedFailed) {
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

        // Shared Visual Plan / Astra Handoff are explicit operator stages.
        // Channel persist must NOT auto-rebuild them; existing artifacts become stale
        // via sourceChannelSnapshot mismatch on next read.
      }
    } catch {
      /* best-effort persist */
    }
  }

  return bundle;
}
