/**
 * Threads publishable composer — production path requires LLM invoke.
 * Deterministic fallback is diagnostic-only (not publishable success).
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  bodyReflectsPropositionTakeaway,
  buildPropositionProvenance,
  buildChannelComposerPromptParts,
  formatCorePackPromptBlock,
  formatQualityRevisionPromptBlock,
  invokeWithBoundedRepair,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";
import { composeThreadsPublishableDeterministic } from "@/lib/marketing/publishable/threads/deterministicThreads";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";

export type PublishableLlmInvoke = (
  prompt: ChannelComposerPromptParts | string,
) => Promise<string> | string;

function buildThreadsPrompt(
  input: PublishableComposerInput,
  repairHint?: string | null,
): ChannelComposerPromptParts {
  return buildChannelComposerPromptParts({
    channel: "threads",
    writingContract: [
      THREADS_WRITING_CONTRACT,
      formatCorePackPromptBlock(input),
      formatQualityRevisionPromptBlock(input.qualityRevision),
    ]
      .filter(Boolean)
      .join("\n"),
    composerInput: input,
    repairHint,
  });
}

function parseThreadsJson(raw: string): { title: string | null; body: string } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      title?: unknown;
      body?: unknown;
    };
    const body = typeof parsed.body === "string" ? stripEvidenceIdsFromText(parsed.body) : "";
    if (!body) return null;
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? stripEvidenceIdsFromText(parsed.title)
        : null;
    return { title, body };
  } catch {
    return null;
  }
}

function wrapResult(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  title: string | null;
  body: string;
  status: PublishableChannelContent["status"];
  composer: PublishableChannelContent["provenance"]["composer"];
  generationMode: NonNullable<PublishableChannelContent["provenance"]["generationMode"]>;
  attemptCount: number;
  latencyMs: number | null;
  failureCategory?: PublishableChannelContent["provenance"]["failureCategory"];
  failureMessage?: string | null;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText(input.body);
  const publishableSuccess =
    input.composer === "llm" &&
    (input.status === "generated" || input.status === "validated") &&
    validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title: input.title,
    body: input.body,
    status: input.status,
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: input.composer,
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: input.generationMode,
      modelProfile: input.modelProfile ?? null,
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: input.failureCategory ?? null,
      failureMessage: input.failureMessage ?? null,
      propositionStrength: input.composerInput.contentProposition?.propositionStrength ?? null,
      proposition: buildPropositionProvenance(input.composerInput),
    },
    validation,
    publishableSuccess,
    needsRegeneration: !publishableSuccess,
  };
}

export async function composeThreadsPublishableContent(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
  modelProfile?: string | null;
  /** Tests/diagnostics only — never counts as publishable success. */
  allowDeterministicFallback?: boolean;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  const allowFallback = input.allowDeterministicFallback !== false;

  if (propositionBlocksPolishedGeneration(input.composerInput.contentProposition)) {
    const det = allowFallback
      ? composeThreadsPublishableDeterministic(input.composerInput)
      : { title: null, body: "" };
    return wrapResult({
      composerInput: input.composerInput,
      nowIso,
      title: det.title,
      body: det.body || "[generation skipped: insufficient content proposition]",
      status: "generation_failed",
      composer: "deterministic_fallback",
      generationMode: "skipped",
      attemptCount: 0,
      latencyMs: Date.now() - started,
      failureCategory: "insufficient_proposition",
      failureMessage: "propositionStrength=insufficient; polished channel generation skipped",
      modelProfile: input.modelProfile,
    });
  }

  if (input.invoke) {
    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      channel: "threads",
      buildPrompt: (repairHint) => buildThreadsPrompt(input.composerInput, repairHint),
      parseAndValidate: (raw) => {
        const parsed = parseThreadsJson(raw);
        if (!parsed) {
          return { ok: false, category: "invalid_json", message: "threads_json_parse_failed" };
        }
        const validation = validatePublishableText(parsed.body);
        if (!validation.ok) {
          return {
            ok: false,
            category: "publishability_validation",
            message: validation.issues.map((i) => i.code).join(",") || "validation_failed",
          };
        }
        if (!bodyReflectsPropositionTakeaway(parsed.body, input.composerInput.contentProposition)) {
          return {
            ok: false,
            category: "publishability_validation",
            message: "proposition_takeaway_not_reflected",
          };
        }
        return { ok: true };
      },
    });

    if (result.success && result.raw) {
      const parsed = parseThreadsJson(result.raw)!;
      const content = wrapResult({
        composerInput: input.composerInput,
        nowIso,
        title: parsed.title,
        body: parsed.body,
        status: "generated",
        composer: "llm",
        generationMode: "llm",
        attemptCount: result.attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: input.modelProfile,
      });
      if (channelCountsAsPublishableSuccess(content)) return content;
    }

    const det = allowFallback
      ? composeThreadsPublishableDeterministic(input.composerInput)
      : { title: null, body: "" };
    const status = resolveFailureStatus({
      llmAttempted: true,
      category: result.failureCategory,
    });
    return wrapResult({
      composerInput: input.composerInput,
      nowIso,
      title: det.title,
      body: det.body || "[generation failed]",
      status,
      composer: "deterministic_fallback",
      generationMode: "fallback",
      attemptCount: result.attemptCount,
      latencyMs: Date.now() - started,
      failureCategory: result.failureCategory ?? "unknown",
      failureMessage: result.failureMessage ?? "llm_compose_failed",
      modelProfile: input.modelProfile,
    });
  }

  const det = composeThreadsPublishableDeterministic(input.composerInput);
  return wrapResult({
    composerInput: input.composerInput,
    nowIso,
    title: det.title,
    body: det.body,
    status: "fallback_generated",
    composer: "deterministic_fallback",
    generationMode: "fallback",
    attemptCount: 0,
    latencyMs: Date.now() - started,
    failureCategory: "invoke_missing",
    failureMessage: "no PublishableLlmInvoke supplied; diagnostic fallback only",
    modelProfile: input.modelProfile,
  });
}
