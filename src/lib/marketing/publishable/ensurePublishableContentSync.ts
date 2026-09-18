/**
 * Synchronous ensure — DETERMINISTIC / DIAGNOSTIC ONLY.
 *
 * MQ-4: Production must use async `ensurePublishableContent` + PublishableLlmInvoke.
 * This sync helper remains for:
 *   - unit tests
 *   - continuity when explicitly allowed
 *   - reading persisted bundles without LLM
 *
 * Fallback output always has publishableSuccess=false.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
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
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { composeInstagramPublishableDeterministic } from "@/lib/marketing/publishable/instagram/deterministicInstagram";
import { composeKakaoChannelPublishableDeterministic } from "@/lib/marketing/publishable/kakao_channel/deterministicKakao";
import { composeNaverBandPublishableDeterministic } from "@/lib/marketing/publishable/naver_band/deterministicBand";
import { composeNaverBlogPublishableDeterministic } from "@/lib/marketing/publishable/naver_blog/deterministicBlog";
import { composeShortformNarrationDeterministic } from "@/lib/marketing/publishable/shortform/deterministicShortform";
import { composeThreadsPublishableDeterministic } from "@/lib/marketing/publishable/threads/deterministicThreads";
import {
  looksLikeInternalPlanningBody,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

function tryReadBundle(packageRoot: string | null | undefined): PublishableContentBundle | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    if (raw?.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) return null;
    if (!raw.threads || !raw.shortform) return null;
    return {
      ...raw,
      targetChannels: raw.targetChannels ?? ["threads", "shortform"],
    };
  } catch {
    return null;
  }
}

function threadsFromHuman(
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

function markFallback(
  content: Omit<PublishableChannelContent, "publishableSuccess" | "needsRegeneration"> &
    Partial<Pick<PublishableChannelContent, "publishableSuccess" | "needsRegeneration">>,
): PublishableChannelContent {
  return {
    ...content,
    publishableSuccess: false,
    needsRegeneration: true,
    provenance: {
      ...content.provenance,
      generationMode: content.provenance.generationMode ?? "fallback",
      failureCategory: content.provenance.failureCategory ?? "invoke_missing",
      failureMessage:
        content.provenance.failureMessage ??
        "deterministic sync path — not production publishable success",
    },
  };
}

function shortformContent(
  candidate: CompletedMarketingCandidate,
  composerInput: ReturnType<typeof buildPublishableComposerInput>,
  nowIso: string,
): PublishableChannelContent {
  const det = composeShortformNarrationDeterministic(composerInput);
  return markFallback({
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "shortform",
    format: "short_video_narration",
    title: null,
    body: det.body,
    status: "fallback_generated",
    generatedAt: nowIso,
    sourceCandidateId: candidate.candidateId,
    sourceRevision: composerInput.sourceRevision,
    provenance: {
      composer: "deterministic_fallback",
      evidenceRefIds: composerInput.evidenceRefIds,
      commercialIntent: composerInput.commercialIntent,
    },
    validation: validatePublishableText(det.body),
    narrationSegments: det.segments,
  });
}

function wrapChannel(
  channel: PublishableChannel,
  format: PublishableChannelContent["format"],
  det: {
    title: string | null;
    body: string;
    blogMeta?: PublishableChannelContent["blogMeta"];
    instagramMeta?: PublishableChannelContent["instagramMeta"];
  },
  composerInput: ReturnType<typeof buildPublishableComposerInput>,
  nowIso: string,
): PublishableChannelContent {
  return markFallback({
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format,
    title: det.title,
    body: det.body,
    status: "fallback_generated",
    generatedAt: nowIso,
    sourceCandidateId: composerInput.candidateId,
    sourceRevision: composerInput.sourceRevision,
    selectedAngleRef: composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: "deterministic_fallback",
      evidenceRefIds: composerInput.evidenceRefIds,
      commercialIntent: composerInput.commercialIntent,
    },
    validation: validatePublishableText(det.body, {
      channel,
      title: det.title,
      primaryTopic: det.blogMeta?.primaryTopic,
      allowHeadings: channel === "naver_blog",
    }),
    blogMeta: det.blogMeta,
    instagramMeta: det.instagramMeta,
  });
}

export function ensurePublishableContentSync(input: {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  humanDraft?: HumanReviewDraft | null;
  humanEditedAfterGovernance?: boolean;
  forceRegenerate?: boolean;
  forceRegenerateChannels?: PublishableChannel[];
  now?: Date;
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
  explicitTargetChannels?: PublishableChannel[] | null;
  /**
   * MQ-4 — production callers must pass false.
   * When false: only reuse persisted LLM/human artifacts; never invent new deterministic
   * "publishable" copy (may return existing or incomplete bundle without regenerating).
   * Default true for unit-test / diagnostic continuity.
   */
  allowDeterministicGeneration?: boolean;
}): PublishableContentBundle {
  const nowIso = (input.now ?? new Date()).toISOString();
  const acrb = input.audienceContentResearchBrief ?? null;
  const sourceRevision = computePublishableSourceRevision(input.candidate, input.humanDraft, acrb);
  const existing = tryReadBundle(input.packageRoot);
  const composerInput = buildPublishableComposerInput(input.candidate, {
    acrb,
    explicitTargetChannels: input.explicitTargetChannels,
  });
  const targetChannels = composerInput.targetChannels;
  const allowDet = input.allowDeterministicGeneration !== false;

  const humanOwns =
    Boolean(input.humanEditedAfterGovernance) &&
    Boolean(input.humanDraft?.body?.trim()) &&
    !looksLikeInternalPlanningBody(input.humanDraft!.body);

  const scopedOnly = Boolean(input.forceRegenerateChannels?.length);
  if (
    existing &&
    existing.candidateId === input.candidate.candidateId &&
    existing.sourceRevision === sourceRevision &&
    !input.forceRegenerate &&
    !scopedOnly
  ) {
    if (humanOwns && input.humanDraft) {
      return {
        ...existing,
        targetChannels: existing.targetChannels ?? targetChannels,
        sourceRevision,
        generatedAt: nowIso,
        threads: threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso),
      };
    }
    return existing;
  }

  // Production-safe: reuse prior revision when deterministic generation is disallowed.
  if (!allowDet) {
    if (existing && existing.candidateId === input.candidate.candidateId) {
      if (humanOwns && input.humanDraft) {
        return {
          ...existing,
          targetChannels: existing.targetChannels ?? targetChannels,
          sourceRevision,
          generatedAt: nowIso,
          threads: threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso),
        };
      }
      return {
        ...existing,
        targetChannels: existing.targetChannels ?? targetChannels,
        sourceRevision: existing.sourceRevision,
        generatedAt: nowIso,
      };
    }
    const failed = (channel: PublishableChannel, format: PublishableChannelContent["format"]) =>
      markFallback({
        contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
        channel,
        format,
        title: null,
        body: "[awaiting LLM channel generation]",
        status: "generation_failed",
        generatedAt: nowIso,
        sourceCandidateId: input.candidate.candidateId,
        sourceRevision,
        provenance: {
          composer: "deterministic_fallback",
          evidenceRefIds: composerInput.evidenceRefIds,
          commercialIntent: composerInput.commercialIntent,
          failureCategory: "invoke_missing",
          failureMessage:
            "sync path without allowDeterministicGeneration — generation required via ensurePublishableContent",
        },
        validation: {
          ok: false,
          issues: [{ code: "empty_body", message: "awaiting LLM generation" }],
        },
      });
    return {
      contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
      candidateId: input.candidate.candidateId,
      businessDateKst: input.candidate.businessDateKst,
      generatedAt: nowIso,
      sourceRevision,
      targetChannels,
      threads:
        humanOwns && input.humanDraft
          ? threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso)
          : failed("threads", "threads_text"),
      shortform: failed("shortform", "short_video_narration"),
    };
  }

  const forceAll = Boolean(input.forceRegenerate && !input.forceRegenerateChannels?.length);
  const forceSet = new Set(input.forceRegenerateChannels ?? []);

  const keep = (channel: PublishableChannel, prev?: PublishableChannelContent) => {
    if (!prev?.body) return false;
    if (prev.status === "human_edited") return true;
    if (forceAll) return false;
    if (forceSet.has(channel)) return false;
    if (!forceAll && !scopedOnly && existing?.sourceRevision !== sourceRevision) return false;
    if (scopedOnly && !forceSet.has(channel)) return true;
    return !forceAll && !scopedOnly && existing?.sourceRevision === sourceRevision;
  };

  const threads =
    humanOwns && input.humanDraft
      ? threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso)
      : keep("threads", existing?.threads) && existing?.threads
        ? existing.threads
        : (() => {
            const det = composeThreadsPublishableDeterministic(composerInput);
            return markFallback({
              contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
              channel: "threads" as const,
              format: "threads_text" as const,
              title: det.title,
              body: det.body,
              status: "fallback_generated" as const,
              generatedAt: nowIso,
              sourceCandidateId: input.candidate.candidateId,
              sourceRevision,
              provenance: {
                composer: "deterministic_fallback" as const,
                evidenceRefIds: composerInput.evidenceRefIds,
                commercialIntent: composerInput.commercialIntent,
              },
              validation: validatePublishableText(det.body),
            });
          })();

  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    targetChannels,
    threads,
    shortform:
      keep("shortform", existing?.shortform) && existing?.shortform
        ? existing.shortform
        : shortformContent(input.candidate, composerInput, nowIso),
  };

  for (const channel of ["naver_blog", "naver_band", "kakao_channel", "instagram"] as const) {
    const prev = existing?.[channel];
    if (prev?.status === "human_edited") {
      bundle[channel] = prev;
    }
  }

  if (targetChannels.includes("naver_blog")) {
    bundle.naver_blog =
      keep("naver_blog", existing?.naver_blog) && existing?.naver_blog
        ? existing.naver_blog
        : wrapChannel(
            "naver_blog",
            "naver_blog_article",
            composeNaverBlogPublishableDeterministic(composerInput),
            composerInput,
            nowIso,
          );
  }

  if (targetChannels.includes("naver_band")) {
    bundle.naver_band =
      keep("naver_band", existing?.naver_band) && existing?.naver_band
        ? existing.naver_band
        : wrapChannel(
            "naver_band",
            "naver_band_post",
            composeNaverBandPublishableDeterministic(composerInput),
            composerInput,
            nowIso,
          );
  }

  if (targetChannels.includes("kakao_channel")) {
    bundle.kakao_channel =
      keep("kakao_channel", existing?.kakao_channel) && existing?.kakao_channel
        ? existing.kakao_channel
        : wrapChannel(
            "kakao_channel",
            "kakao_channel_post",
            composeKakaoChannelPublishableDeterministic(composerInput),
            composerInput,
            nowIso,
          );
  }

  if (targetChannels.includes("instagram")) {
    bundle.instagram =
      keep("instagram", existing?.instagram) && existing?.instagram
        ? existing.instagram
        : wrapChannel(
            "instagram",
            "instagram_caption",
            composeInstagramPublishableDeterministic(composerInput),
            composerInput,
            nowIso,
          );
  }

  return bundle;
}
