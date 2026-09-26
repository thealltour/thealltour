/**
 * Naver Band publishable composer — LLM required for publishable success.
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
import { composeNaverBandPublishableDeterministic } from "@/lib/marketing/publishable/naver_band/deterministicBand";
import { naverBandWritingContract } from "@/lib/marketing/publishable/naver_band/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";

function buildPrompt(
  input: PublishableComposerInput,
  repairHint?: string | null,
): ChannelComposerPromptParts {
  const hasApproved = Boolean(input.approvedCanonicalAsset);
  return buildChannelComposerPromptParts({
    channel: "naver_band",
    writingContract: [
      naverBandWritingContract({ hasApprovedCanonicalAsset: hasApproved }),
      "Channel: community-native Band post. Practical checklist / experience question welcome — same approved Story.",
      formatCorePackPromptBlock(input),
      formatQualityRevisionPromptBlock(input.qualityRevision),
    ]
      .filter(Boolean)
      .join("\n"),
    composerInput: input,
    repairHint,
  });
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
  const validation = validatePublishableText(input.body, { channel: "naver_band" });
  const publishableSuccess =
    input.composer === "llm" && input.status === "generated" && validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_band",
    format: "naver_band_post",
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

export async function composeNaverBandPublishableContent(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
  modelProfile?: string | null;
  allowDeterministicFallback?: boolean;
  /**
   * Production packageRoot path uses Naver Band Copy Specialist (fail-closed).
   * Legacy single-shot channel-editor-naver-band remains for tests / no-packageRoot.
   */
  useNaverBandCopySpecialist?: boolean;
  packageRoot?: string | null;
  /** When true, specialist must not reuse package band-copy artifacts. */
  forceRegenerate?: boolean;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  const allowFallback = input.allowDeterministicFallback !== false;

  if (propositionBlocksPolishedGeneration(input.composerInput.contentProposition)) {
    const det = allowFallback
      ? composeNaverBandPublishableDeterministic(input.composerInput)
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

  const preferSpecialist =
    input.useNaverBandCopySpecialist !== false &&
    (input.useNaverBandCopySpecialist === true || Boolean(input.packageRoot)) &&
    Boolean(input.invoke) &&
    Boolean(input.composerInput.approvedCanonicalAsset) &&
    Boolean(input.composerInput.editorialNarrativePlan);

  if (preferSpecialist && input.invoke) {
    const { runNaverBandCopySpecialist } = await import(
      "@/lib/marketing/publishable/naverBandCopy/pipeline"
    );
    const result = await runNaverBandCopySpecialist({
      composerInput: input.composerInput,
      invoke: input.invoke,
      now: input.now,
      packageRoot: input.packageRoot,
      modelProfile: input.modelProfile,
      forceRegenerate: Boolean(input.forceRegenerate),
    });
    // Fail-closed: do not quietly fall back to channel-editor-naver-band / deterministic.
    return result.content;
  }

  if (input.invoke) {
    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      channel: "naver_band",
      buildPrompt: (hint) => buildPrompt(input.composerInput, hint),
      parseAndValidate: (raw) => {
        const parsed = parseBodyJson(raw);
        if (!parsed) return { ok: false, category: "invalid_json", message: "band_json_parse_failed" };
        const validation = validatePublishableText(parsed.body, { channel: "naver_band" });
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
      ? composeNaverBandPublishableDeterministic(input.composerInput)
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

  const det = composeNaverBandPublishableDeterministic(input.composerInput);
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
