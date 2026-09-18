/**
 * Threads publishable composer — production path requires LLM invoke.
 * Deterministic fallback is diagnostic-only (not publishable success).
 * Optional mediaPlan is planning metadata only (no image generation/attachment).
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableThreadsMediaPlan,
} from "@/lib/marketing/publishable/contracts";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
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
import {
  SOCIAL_VISUAL_ASSET_FAMILY,
  stableSocialVisualId,
} from "@/lib/marketing/publishable/socialVisualPlan";
import {
  compressThreadsBodyToLimit,
  threadsLengthRepairHint,
} from "@/lib/marketing/publishable/threads/compressThreadsBody";
import { composeThreadsPublishableDeterministic } from "@/lib/marketing/publishable/threads/deterministicThreads";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import {
  THREADS_BODY_MAX_CHARS,
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
  let lengthRepair: string | null = null;
  if (repairHint) {
    const match = /too_long:(\d+)>(\d+)/i.exec(repairHint);
    if (match) {
      const actual = Number(match[1]);
      const max = Number(match[2]);
      lengthRepair = threadsLengthRepairHint(Math.max(0, actual - max), actual);
    } else if (/too_long/i.test(repairHint)) {
      lengthRepair = threadsLengthRepairHint(1, THREADS_BODY_MAX_CHARS + 1);
    }
  }
  return buildChannelComposerPromptParts({
    channel: "threads",
    writingContract: [
      THREADS_WRITING_CONTRACT,
      formatCorePackPromptBlock(input),
      formatQualityRevisionPromptBlock(
        input.qualityRevision,
        input.storyLock?.editorialArchetype,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    composerInput: input,
    repairHint: [repairHint, lengthRepair].filter(Boolean).join("\n") || null,
  });
}

function asExplicitBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "TRUE" || value === 1) return true;
  if (value === "false" || value === "FALSE" || value === 0) return false;
  return undefined;
}

function normalizeMediaPlan(raw: unknown): PublishableThreadsMediaPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const recommendedExplicit = asExplicitBoolean(obj.recommended);
  const recommended = recommendedExplicit ?? false;
  let imageCount =
    typeof obj.imageCount === "number" && Number.isFinite(obj.imageCount)
      ? Math.max(0, Math.min(3, Math.floor(obj.imageCount)))
      : 0;
  const visualsRaw = Array.isArray(obj.visuals) ? obj.visuals : [];
  const visuals: PublishableThreadsMediaPlan["visuals"] = [];
  for (let i = 0; i < Math.min(3, visualsRaw.length); i++) {
    const row = visualsRaw[i];
    if (!row || typeof row !== "object") continue;
    const v = row as Record<string, unknown>;
    const intent =
      typeof v.visualIntent === "string" ? stripEvidenceIdsFromText(v.visualIntent).slice(0, 400) : "";
    const role =
      typeof v.role === "string" && v.role.trim()
        ? stripEvidenceIdsFromText(v.role).slice(0, 64)
        : "cover_context";
    const visualId =
      typeof v.visualId === "string" && /^social_visual_\d{2,}$/.test(v.visualId.trim())
        ? v.visualId.trim()
        : stableSocialVisualId(i + 1);
    visuals.push({
      visualId,
      role,
      visualIntent: intent,
      reusableOnInstagram: asExplicitBoolean(v.reusableOnInstagram) ?? false,
    });
  }
  if (!recommended && visuals.length === 0) {
    return {
      recommended: false,
      assetFamily: SOCIAL_VISUAL_ASSET_FAMILY,
      imageCount: 0,
      visuals: [],
    };
  }
  if (recommended && visuals.length === 0) {
    imageCount = 0;
  } else if (visuals.length > 0) {
    imageCount = Math.min(3, visuals.length);
  }
  return {
    recommended: recommended && imageCount > 0,
    assetFamily: SOCIAL_VISUAL_ASSET_FAMILY,
    imageCount,
    visuals: visuals.slice(0, imageCount || visuals.length),
  };
}

export function parseThreadsJson(
  raw: string,
): { title: string | null; body: string; mediaPlan: PublishableThreadsMediaPlan | null } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      title?: unknown;
      body?: unknown;
      mediaPlan?: unknown;
    };
    const body = typeof parsed.body === "string" ? stripEvidenceIdsFromText(parsed.body) : "";
    if (!body) return null;
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? stripEvidenceIdsFromText(parsed.title)
        : null;
    return {
      title,
      body,
      mediaPlan: normalizeMediaPlan(parsed.mediaPlan),
    };
  } catch {
    return null;
  }
}

function wrapResult(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  title: string | null;
  body: string;
  mediaPlan?: PublishableThreadsMediaPlan | null;
  status: PublishableChannelContent["status"];
  composer: PublishableChannelContent["provenance"]["composer"];
  generationMode: NonNullable<PublishableChannelContent["provenance"]["generationMode"]>;
  attemptCount: number;
  latencyMs: number | null;
  failureCategory?: PublishableChannelContent["provenance"]["failureCategory"];
  failureMessage?: string | null;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText(input.body, { channel: "threads" });
  const publishableSuccess =
    input.composer === "llm" &&
    (input.status === "generated" || input.status === "validated") &&
    validation.ok;
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
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
      compositionMode,
      inputAuthorityVersion: input.composerInput.approvedCanonicalAsset
        ? CHANNEL_INPUT_AUTHORITY_VERSION
        : null,
    },
    validation,
    publishableSuccess,
    needsRegeneration: !publishableSuccess,
    mediaPlan: input.mediaPlan ?? null,
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
      mediaPlan: null,
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
    const acceptedHolder: {
      current: {
        title: string | null;
        body: string;
        mediaPlan: PublishableThreadsMediaPlan | null;
      } | null;
    } = { current: null };

    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      channel: "threads",
      buildPrompt: (repairHint) => buildThreadsPrompt(input.composerInput, repairHint),
      parseAndValidate: (raw) => {
        const parsed = parseThreadsJson(raw);
        if (!parsed) {
          return { ok: false, category: "invalid_json", message: "threads_json_parse_failed" };
        }
        let body = parsed.body;
        if (body.length > THREADS_BODY_MAX_CHARS) {
          // Compress before treating length as a hard publishability failure.
          body = compressThreadsBodyToLimit(body, THREADS_BODY_MAX_CHARS);
        }
        const validation = validatePublishableText(body, { channel: "threads" });
        if (!validation.ok) {
          const codes = validation.issues.map((i) => i.code);
          const tooLong = validation.issues.find((i) => i.code === "too_long");
          return {
            ok: false,
            category: "publishability_validation",
            message: tooLong
              ? `too_long:${parsed.body.length}>${THREADS_BODY_MAX_CHARS}`
              : codes.join(",") || "validation_failed",
          };
        }
        if (!bodyReflectsPropositionTakeaway(body, input.composerInput.contentProposition)) {
          return {
            ok: false,
            category: "publishability_validation",
            message: "proposition_takeaway_not_reflected",
          };
        }
        acceptedHolder.current = {
          title: parsed.title,
          body,
          mediaPlan: parsed.mediaPlan,
        };
        return { ok: true };
      },
    });

    if (result.success && acceptedHolder.current) {
      const accepted = acceptedHolder.current;
      const content = wrapResult({
        composerInput: input.composerInput,
        nowIso,
        title: accepted.title,
        body: accepted.body,
        mediaPlan: accepted.mediaPlan,
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
      mediaPlan: null,
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
    mediaPlan: null,
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
