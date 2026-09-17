/**
 * Instagram publishable composer — caption + slide headlines for the cardnews.
 *
 * IG differs from the other channels in two ways that the validator enforces:
 * the first 125 characters are the whole first impression, and a caption cannot
 * carry a clickable link, so the CTA has to resolve to comment / save / profile.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableInstagramMeta,
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
import { composeInstagramPublishableDeterministic } from "@/lib/marketing/publishable/instagram/deterministicInstagram";
import { INSTAGRAM_WRITING_CONTRACT } from "@/lib/marketing/publishable/instagram/writingContract";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  INSTAGRAM_HASHTAG_MAX,
  extractInstagramHashtags,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

const SLIDE_HEADLINE_MAX_CHARS = 24;
const SLIDE_MIN = 4;
const SLIDE_MAX = 7;

function buildPrompt(input: PublishableComposerInput, repairHint?: string | null): string {
  return [
    INSTAGRAM_WRITING_CONTRACT,
    PROPOSITION_COMPOSER_RULES,
    "Channel: visual-first carousel. One idea per slide; the caption adds the context the cards cannot fit.",
    formatCorePackPromptBlock(input),
    formatQualityRevisionPromptBlock(input.qualityRevision),
    repairHint ?? "",
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      hookHint: input.hookHint,
      keyMessage: input.keyMessage,
      destinations: input.destinations,
      contentProposition: buildPropositionPromptSlice(input.contentProposition),
      research: {
        selectedAngle: input.research?.selectedAngle,
        selectedAngleTension: input.research?.selectedAngleTension,
        motivations: input.research?.motivations,
        contentGaps: input.research?.contentGaps,
        limitations: input.research?.limitations,
      },
      usableFacts: input.usableFacts.map((fact) => ({
        statement: fact.statement,
        type: fact.epistemicType ?? null,
      })),
      avoidedStatements: input.avoidedStatements,
      unsupportedClaims: input.unsupportedClaims,
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

type ParsedInstagram = {
  body: string;
  meta: PublishableInstagramMeta;
};

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => stripEvidenceIdsFromText(item))
    .filter(Boolean)
    .slice(0, limit);
}

export function parseInstagramJson(raw: string): ParsedInstagram | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const body = typeof parsed.body === "string" ? stripEvidenceIdsFromText(parsed.body) : "";
    if (!body) return null;

    const slideHeadlines = asStringArray(parsed.slideHeadlines, SLIDE_MAX);
    const declaredHashtags = asStringArray(parsed.hashtags, INSTAGRAM_HASHTAG_MAX).map((tag) =>
      tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`,
    );
    // The caption is the source of truth for what actually publishes.
    const hashtags = declaredHashtags.length ? declaredHashtags : extractInstagramHashtags(body);

    const hook =
      typeof parsed.hook === "string" && parsed.hook.trim()
        ? stripEvidenceIdsFromText(parsed.hook)
        : body.split(/\n/)[0] ?? "";

    return {
      body,
      meta: {
        hook,
        hashtags,
        slideHeadlines,
        cta: typeof parsed.cta === "string" && parsed.cta.trim() ? stripEvidenceIdsFromText(parsed.cta) : null,
        altText:
          typeof parsed.altText === "string" && parsed.altText.trim()
            ? stripEvidenceIdsFromText(parsed.altText)
            : null,
      },
    };
  } catch {
    return null;
  }
}

/** Slide overlays must fit the card and cover more than one point. */
export function slideHeadlineIssues(slideHeadlines: string[]): string[] {
  const issues: string[] = [];
  if (slideHeadlines.length < SLIDE_MIN) issues.push("slides_too_few");
  if (slideHeadlines.length > SLIDE_MAX) issues.push("slides_too_many");
  if (slideHeadlines.some((line) => line.length > SLIDE_HEADLINE_MAX_CHARS)) {
    issues.push("slide_headline_too_long");
  }
  if (new Set(slideHeadlines.map((line) => line.trim())).size !== slideHeadlines.length) {
    issues.push("slide_headline_duplicate");
  }
  return issues;
}

function wrap(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  body: string;
  instagramMeta: PublishableInstagramMeta | undefined;
  status: PublishableChannelContent["status"];
  composer: PublishableChannelContent["provenance"]["composer"];
  generationMode: NonNullable<PublishableChannelContent["provenance"]["generationMode"]>;
  attemptCount: number;
  latencyMs: number | null;
  failureCategory?: PublishableChannelContent["provenance"]["failureCategory"];
  failureMessage?: string | null;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText(input.body, { channel: "instagram" });
  const publishableSuccess =
    input.composer === "llm" && input.status === "generated" && validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "instagram",
    format: "instagram_caption",
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
    instagramMeta: input.instagramMeta,
  };
}

export async function composeInstagramPublishableContent(input: {
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
      ? composeInstagramPublishableDeterministic(input.composerInput)
      : { body: "", instagramMeta: undefined };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      body: det.body || "[generation skipped: insufficient content proposition]",
      instagramMeta: det.instagramMeta,
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
      channel: "instagram",
      buildPrompt: (hint) => buildPrompt(input.composerInput, hint),
      parseAndValidate: (raw) => {
        const parsed = parseInstagramJson(raw);
        if (!parsed) {
          return { ok: false, category: "invalid_json", message: "instagram_json_parse_failed" };
        }
        const validation = validatePublishableText(parsed.body, { channel: "instagram" });
        if (!validation.ok) {
          return {
            ok: false,
            category: "publishability_validation",
            message: validation.issues.map((issue) => issue.code).join(","),
          };
        }
        const slideIssues = slideHeadlineIssues(parsed.meta.slideHeadlines);
        if (slideIssues.length > 0) {
          return {
            ok: false,
            category: "schema_validation",
            message: slideIssues.join(","),
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
      const parsed = parseInstagramJson(result.raw)!;
      return wrap({
        composerInput: input.composerInput,
        nowIso,
        body: parsed.body,
        instagramMeta: parsed.meta,
        status: "generated",
        composer: "llm",
        generationMode: "llm",
        attemptCount: result.attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: input.modelProfile,
      });
    }

    const det = allowFallback
      ? composeInstagramPublishableDeterministic(input.composerInput)
      : { body: "", instagramMeta: undefined };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      body: det.body || "[generation failed]",
      instagramMeta: det.instagramMeta,
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

  const det = composeInstagramPublishableDeterministic(input.composerInput);
  return wrap({
    composerInput: input.composerInput,
    nowIso,
    body: det.body,
    instagramMeta: det.instagramMeta,
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
