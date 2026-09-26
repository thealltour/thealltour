/**
 * Shortform narration composer — LLM required for publishable success.
 * Hook must be paid off; READY render invalidation remains caller's responsibility.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableNarrationSegment,
} from "@/lib/marketing/publishable/contracts";
import {
  bodyReflectsPropositionTakeaway,
  buildPropositionProvenance,
  buildChannelComposerPromptParts,
  checkShortformHookPayoff,
  formatCorePackPromptBlock,
  formatQualityRevisionPromptBlock,
  invokeWithBoundedRepair,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeShortformNarrationDeterministic } from "@/lib/marketing/publishable/shortform/deterministicShortform";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";

function buildShortformPrompt(
  input: PublishableComposerInput,
  repairHint?: string | null,
): ChannelComposerPromptParts {
  return buildChannelComposerPromptParts({
    channel: "shortform",
    writingContract: [
      SHORTFORM_NARRATION_WRITING_CONTRACT,
      "Structure: hook → concrete fact/context → concrete contrast/detail → natural close (close/action optional; payoff is semantic, not a forced abstract sentence).",
      "If hook promises N things / one rule / a checklist, body MUST deliver it — without changing the approved Story.",
      formatCorePackPromptBlock(input),
      formatQualityRevisionPromptBlock(input.qualityRevision),
    ]
      .filter(Boolean)
      .join("\n"),
    composerInput: input,
    repairHint,
  });
}

function parseShortformJson(
  raw: string,
  input: PublishableComposerInput,
): { body: string; segments: PublishableNarrationSegment[] } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      body?: unknown;
      segments?: unknown;
    };
    if (!Array.isArray(parsed.segments) || parsed.segments.length < 1) return null;
    const segments: PublishableNarrationSegment[] = [];
    for (const [index, item] of parsed.segments.entries()) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const narrationText =
        typeof rec.narrationText === "string" ? stripEvidenceIdsFromText(rec.narrationText) : "";
      if (!narrationText) continue;
      const purpose =
        typeof rec.purpose === "string" && rec.purpose.trim()
          ? rec.purpose.trim().slice(0, 64)
          : index === 0
            ? "hook"
            : "body";
      const visualIntent =
        typeof rec.visualIntent === "string" && rec.visualIntent.trim()
          ? stripEvidenceIdsFromText(rec.visualIntent).slice(0, 400)
          : input.destinations[0]
            ? `${input.destinations[0]} travel visual`
            : "travel lifestyle visual";
      segments.push({
        segmentId: `narr-${String(segments.length + 1).padStart(2, "0")}`,
        narrationText: narrationText.slice(0, 2000),
        subtitleText: narrationText.slice(0, 2000),
        purpose,
        visualIntent,
        evidenceRefs: input.evidenceRefIds.slice(0, 4),
      });
    }
    if (segments.length < 1) return null;
    if (segments.length > 1) {
      segments[segments.length - 1]!.purpose = "close";
    }
    const body =
      typeof parsed.body === "string" && parsed.body.trim()
        ? stripEvidenceIdsFromText(parsed.body)
        : segments.map((s) => s.narrationText).join("\n\n");
    return { body, segments: segments.slice(0, 8) };
  } catch {
    return null;
  }
}

function wrap(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  body: string;
  segments: PublishableNarrationSegment[];
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
    input.composer === "llm" && input.status === "generated" && validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "shortform",
    format: "short_video_narration",
    title: null,
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
    narrationSegments: input.segments,
  };
}

export async function composeShortformNarration(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
  modelProfile?: string | null;
  allowDeterministicFallback?: boolean;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  const allowFallback = input.allowDeterministicFallback !== false;

  if (propositionBlocksPolishedGeneration(input.composerInput.contentProposition)) {
    const det = allowFallback
      ? composeShortformNarrationDeterministic(input.composerInput)
      : { body: "[generation skipped: insufficient content proposition]", segments: [] };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      body: det.body,
      segments: det.segments,
      status: "generation_failed",
      composer: "deterministic_fallback",
      generationMode: "skipped",
      attemptCount: 0,
      latencyMs: Date.now() - started,
      failureCategory: "insufficient_proposition",
      failureMessage: "propositionStrength=insufficient",
      modelProfile: input.modelProfile,
    });
  }

  if (input.invoke) {
    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      channel: "shortform",
      buildPrompt: (hint) => buildShortformPrompt(input.composerInput, hint),
      parseAndValidate: (raw) => {
        const parsed = parseShortformJson(raw, input.composerInput);
        if (!parsed) return { ok: false, category: "invalid_json", message: "shortform_json_parse_failed" };
        const validation = validatePublishableText(parsed.body);
        const segOk = parsed.segments.every((s) => validatePublishableText(s.narrationText).ok);
        if (!validation.ok || !segOk) {
          return {
            ok: false,
            category: "publishability_validation",
            message: validation.issues.map((i) => i.code).join(",") || "segment_validation_failed",
          };
        }
        const payoff = checkShortformHookPayoff({
          segments: parsed.segments,
          body: parsed.body,
        });
        if (!payoff.ok) {
          return {
            ok: false,
            category: "publishability_validation",
            message: payoff.reason ?? "hook_payoff_failed",
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
      const parsed = parseShortformJson(result.raw, input.composerInput)!;
      return wrap({
        composerInput: input.composerInput,
        nowIso,
        body: parsed.body,
        segments: parsed.segments,
        status: "generated",
        composer: "llm",
        generationMode: "llm",
        attemptCount: result.attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: input.modelProfile,
      });
    }
    const det = allowFallback
      ? composeShortformNarrationDeterministic(input.composerInput)
      : { body: "[generation failed]", segments: [] };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      body: det.body,
      segments: det.segments,
      status: resolveFailureStatus({ llmAttempted: true, category: result.failureCategory }),
      composer: "deterministic_fallback",
      generationMode: "fallback",
      attemptCount: result.attemptCount,
      latencyMs: Date.now() - started,
      failureCategory: result.failureCategory ?? "unknown",
      failureMessage: result.failureMessage ?? "llm_compose_failed",
      modelProfile: input.modelProfile,
    });
  }

  const det = composeShortformNarrationDeterministic(input.composerInput);
  return wrap({
    composerInput: input.composerInput,
    nowIso,
    body: det.body,
    segments: det.segments,
    status: "fallback_generated",
    composer: "deterministic_fallback",
    generationMode: "fallback",
    attemptCount: 0,
    latencyMs: Date.now() - started,
    failureCategory: "invoke_missing",
    failureMessage: "no PublishableLlmInvoke supplied",
    modelProfile: input.modelProfile,
  });
}
