/**
 * Idempotent ensure: generate or reuse PublishableContentBundle.
 * Never silently overwrite human-edited channel bodies.
 * Optional CG-4B channels only when selected in targetChannels.
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
  now?: Date;
  /** Durable ACRB — never triggers external research. */
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
  /** Explicit channel selection for human review generation. */
  explicitTargetChannels?: PublishableChannel[] | null;
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
    },
    validation: validatePublishableText(body),
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
  const sourceRevision = computePublishableSourceRevision(input.candidate, input.humanDraft, acrb);
  const existing = tryReadBundle(input.packageRoot);
  const composerInput = buildPublishableComposerInput(input.candidate, {
    acrb,
    explicitTargetChannels: input.explicitTargetChannels,
  });
  const targetChannels = composerInput.targetChannels;

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
      };
    }
    return existing;
  }

  const threads =
    humanOwnsThreads && input.humanDraft
      ? threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso)
      : !shouldRegen("threads", input, existing?.threads) && existing?.threads
        ? existing.threads
        : await composeThreadsPublishableContent({
            composerInput,
            now,
            invoke: input.invoke,
          });

  const shortform =
    !shouldRegen("shortform", input, existing?.shortform) && existing?.shortform
      ? existing.shortform
      : await composeShortformNarration({
          composerInput,
          now,
          invoke: input.invoke,
        });

  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    targetChannels,
    threads,
    shortform,
  };

  // Preserve human-edited optional channels not targeted for regen
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
        : await composeNaverBlogPublishableContent({
            composerInput,
            now,
            invoke: input.invoke,
          });
  }

  if (targetChannels.includes("naver_band")) {
    bundle.naver_band =
      !shouldRegen("naver_band", input, existing?.naver_band) && existing?.naver_band
        ? existing.naver_band
        : await composeNaverBandPublishableContent({
            composerInput,
            now,
            invoke: input.invoke,
          });
  }

  if (targetChannels.includes("kakao_channel")) {
    bundle.kakao_channel =
      !shouldRegen("kakao_channel", input, existing?.kakao_channel) && existing?.kakao_channel
        ? existing.kakao_channel
        : await composeKakaoChannelPublishableContent({
            composerInput,
            now,
            invoke: input.invoke,
          });
  }

  return bundle;
}
