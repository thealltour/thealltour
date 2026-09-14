/**
 * Kakao Channel publishable composer — LLM required for publishable success.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  PROPOSITION_COMPOSER_RULES,
  bodyReflectsPropositionTakeaway,
  buildPropositionPromptSlice,
  buildPropositionProvenance,
  formatCorePackPromptBlock,
  formatQualityRevisionPromptBlock,
  invokeWithBoundedRepair,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeKakaoChannelPublishableDeterministic } from "@/lib/marketing/publishable/kakao_channel/deterministicKakao";
import { KAKAO_CHANNEL_WRITING_CONTRACT } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";

function buildPrompt(input: PublishableComposerInput, repairHint?: string | null): string {
  return [
    KAKAO_CHANNEL_WRITING_CONTRACT,
    PROPOSITION_COMPOSER_RULES,
    "Channel: concise Kakao decision aid / action. Match desiredAudienceAction. No invented urgency/price.",
    formatCorePackPromptBlock(input),
    formatQualityRevisionPromptBlock(input.qualityRevision),
    repairHint ?? "",
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      keyMessage: input.keyMessage,
      contentProposition: buildPropositionPromptSlice(input.contentProposition),
      research: {
        selectedAngle: input.research?.selectedAngle,
        decisionTriggers: input.research?.decisionTriggers,
        anxieties: input.research?.anxieties,
        limitations: input.research?.limitations,
      },
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        type: f.epistemicType ?? null,
      })),
      avoidedStatements: input.avoidedStatements,
      unsupportedClaims: input.unsupportedClaims,
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseBodyJson(raw: string): { title: string | null; body: string } | null {
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

function wrap(input: {
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
  const validation = validatePublishableText(input.body, { channel: "kakao_channel" });
  const publishableSuccess =
    input.composer === "llm" && input.status === "generated" && validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "kakao_channel",
    format: "kakao_channel_post",
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

export async function composeKakaoChannelPublishableContent(input: {
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
      ? composeKakaoChannelPublishableDeterministic(input.composerInput)
      : { title: null, body: "" };
    return wrap({
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
      failureMessage: "propositionStrength=insufficient",
      modelProfile: input.modelProfile,
    });
  }

  if (input.invoke) {
    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      buildPrompt: (hint) => buildPrompt(input.composerInput, hint),
      parseAndValidate: (raw) => {
        const parsed = parseBodyJson(raw);
        if (!parsed) return { ok: false, category: "invalid_json", message: "kakao_json_parse_failed" };
        const validation = validatePublishableText(parsed.body, { channel: "kakao_channel" });
        if (!validation.ok) {
          return {
            ok: false,
            category: "publishability_validation",
            message: validation.issues.map((i) => i.code).join(","),
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
      const parsed = parseBodyJson(result.raw)!;
      return wrap({
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
    }
    const det = allowFallback
      ? composeKakaoChannelPublishableDeterministic(input.composerInput)
      : { title: null, body: "" };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      title: det.title,
      body: det.body || "[generation failed]",
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

  const det = composeKakaoChannelPublishableDeterministic(input.composerInput);
  return wrap({
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
    failureMessage: "no PublishableLlmInvoke supplied",
    modelProfile: input.modelProfile,
  });
}
