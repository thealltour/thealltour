/**
 * Assemble PublishableChannelContent.threads from Threads Copy Specialist artifact.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableThreadsMediaPlan,
} from "@/lib/marketing/publishable/contracts";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildPropositionProvenance,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { parseThreadsJson } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import type { ThreadsCopyArtifact } from "@/lib/marketing/publishable/threadsCopy/contracts";
import { THREADS_COPY_WRITER_HERMES_PROFILE } from "@/lib/marketing/publishable/threadsCopy/contracts";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";

function normalizeMediaPlanFromCopy(
  body: string,
  mediaPlan: unknown,
): PublishableThreadsMediaPlan | null {
  if (mediaPlan == null) return null;
  const parsed = parseThreadsJson(
    JSON.stringify({ title: null, body, mediaPlan }),
  );
  return parsed?.mediaPlan ?? null;
}

export function assemblePublishableThreadsFromCopy(input: {
  composerInput: PublishableComposerInput;
  copy: ThreadsCopyArtifact;
  nowIso: string;
  attemptCount: number;
  latencyMs: number;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText(input.copy.body, { channel: "threads" });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  const publishableSuccess = validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title: null,
    body: input.copy.body,
    status: publishableSuccess ? "generated" : "validation_failed",
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: "llm",
      evidenceRefIds: [
        ...new Set([
          ...input.composerInput.evidenceRefIds,
          ...input.copy.evidenceRefs,
        ]),
      ].slice(0, 24),
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: "llm",
      modelProfile: input.modelProfile ?? THREADS_COPY_WRITER_HERMES_PROFILE,
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: publishableSuccess ? null : "publishability_validation",
      failureMessage: publishableSuccess
        ? null
        : validation.issues.map((i) => i.code).join(",") || "validation_failed",
      propositionStrength: input.composerInput.contentProposition?.propositionStrength ?? null,
      proposition: buildPropositionProvenance(input.composerInput),
      compositionMode,
      inputAuthorityVersion: input.composerInput.approvedCanonicalAsset
        ? CHANNEL_INPUT_AUTHORITY_VERSION
        : null,
    },
    validation,
    publishableSuccess,
    needsRegeneration: !publishableSuccess,
    mediaPlan: normalizeMediaPlanFromCopy(input.copy.body, input.copy.mediaPlan),
  };
}
