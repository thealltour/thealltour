/**
 * Synchronous ensure — deterministic composers only (export / MediaBrief path).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  buildPublishableComposerInput,
  computePublishableSourceRevision,
} from "@/lib/marketing/publishable/inputs";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
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
    if (!raw.threads?.body || !raw.shortform?.body) return null;
    return raw;
  } catch {
    return null;
  }
}

function threadsFromHuman(
  candidate: CompletedMarketingCandidate,
  draft: HumanReviewDraft,
  sourceRevision: string,
  nowIso: string,
): PublishableContentBundle["threads"] {
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

function shortformContent(
  candidate: CompletedMarketingCandidate,
  composerInput: ReturnType<typeof buildPublishableComposerInput>,
  nowIso: string,
): PublishableContentBundle["shortform"] {
  const det = composeShortformNarrationDeterministic(composerInput);
  return {
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
  };
}

export function ensurePublishableContentSync(input: {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  humanDraft?: HumanReviewDraft | null;
  humanEditedAfterGovernance?: boolean;
  forceRegenerate?: boolean;
  now?: Date;
}): PublishableContentBundle {
  const nowIso = (input.now ?? new Date()).toISOString();
  const sourceRevision = computePublishableSourceRevision(input.candidate, input.humanDraft);
  const existing = tryReadBundle(input.packageRoot);
  const composerInput = buildPublishableComposerInput(input.candidate);

  const humanOwns =
    Boolean(input.humanEditedAfterGovernance) &&
    Boolean(input.humanDraft?.body?.trim()) &&
    !looksLikeInternalPlanningBody(input.humanDraft!.body);

  if (
    existing &&
    existing.candidateId === input.candidate.candidateId &&
    existing.sourceRevision === sourceRevision &&
    !input.forceRegenerate
  ) {
    if (humanOwns && input.humanDraft) {
      return {
        ...existing,
        sourceRevision,
        generatedAt: nowIso,
        threads: threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso),
      };
    }
    return existing;
  }

  const threads = humanOwns && input.humanDraft
    ? threadsFromHuman(input.candidate, input.humanDraft, sourceRevision, nowIso)
    : (() => {
        const det = composeThreadsPublishableDeterministic(composerInput);
        return {
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
        };
      })();

  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    threads,
    shortform: shortformContent(input.candidate, composerInput, nowIso),
  };
}
