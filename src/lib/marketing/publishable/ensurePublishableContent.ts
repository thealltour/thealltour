/**
 * Idempotent ensure: generate or reuse PublishableContentBundle.
 * Never silently overwrite human-edited Threads body.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  buildPublishableComposerInput,
  computePublishableSourceRevision,
} from "@/lib/marketing/publishable/inputs";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
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
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
} from "@/lib/marketing/publishable/contracts";

export type EnsurePublishableContentInput = {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  humanDraft?: HumanReviewDraft | null;
  humanEditedAfterGovernance?: boolean;
  /** Force regenerate AI publishable drafts (never overwrites human_edited threads unless allowOverwriteHuman). */
  forceRegenerate?: boolean;
  allowOverwriteHuman?: boolean;
  invoke?: PublishableLlmInvoke | null;
  now?: Date;
};

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

function threadsFromHumanDraft(
  candidate: CompletedMarketingCandidate,
  draft: HumanReviewDraft,
  sourceRevision: string,
  nowIso: string,
): PublishableContentBundle["threads"] {
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
    },
    validation,
  };
}

export async function ensurePublishableContent(
  input: EnsurePublishableContentInput,
): Promise<PublishableContentBundle> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const sourceRevision = computePublishableSourceRevision(input.candidate, input.humanDraft);
  const existing = tryReadBundle(input.packageRoot);

  const humanOwnsThreads =
    Boolean(input.humanEditedAfterGovernance) &&
    Boolean(input.humanDraft?.body?.trim()) &&
    !looksLikeInternalPlanningBody(input.humanDraft!.body) &&
    !input.allowOverwriteHuman;

  if (
    existing &&
    existing.candidateId === input.candidate.candidateId &&
    existing.sourceRevision === sourceRevision &&
    !input.forceRegenerate
  ) {
    if (humanOwnsThreads && input.humanDraft) {
      return {
        ...existing,
        threads: threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso),
        generatedAt: nowIso,
        sourceRevision,
      };
    }
    return existing;
  }

  // Reuse existing shortform/threads when only human draft changed and we preserve human threads
  if (humanOwnsThreads && input.humanDraft && existing && !input.forceRegenerate) {
    const composerInput = buildPublishableComposerInput(input.candidate);
    const shortform =
      existing.sourceRevision === sourceRevision && existing.shortform
        ? existing.shortform
        : await composeShortformNarration({
            composerInput,
            now,
            invoke: input.invoke,
          });
    return {
      contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
      candidateId: input.candidate.candidateId,
      businessDateKst: input.candidate.businessDateKst,
      generatedAt: nowIso,
      sourceRevision,
      threads: threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso),
      shortform,
    };
  }

  const composerInput = buildPublishableComposerInput(input.candidate);
  const threads = humanOwnsThreads && input.humanDraft
    ? threadsFromHumanDraft(input.candidate, input.humanDraft, sourceRevision, nowIso)
    : await composeThreadsPublishableContent({
        composerInput,
        now,
        invoke: input.invoke,
      });

  const shortform = await composeShortformNarration({
    composerInput,
    now,
    invoke: input.invoke,
  });

  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidate.candidateId,
    businessDateKst: input.candidate.businessDateKst,
    generatedAt: nowIso,
    sourceRevision,
    threads,
    shortform,
  };
}
