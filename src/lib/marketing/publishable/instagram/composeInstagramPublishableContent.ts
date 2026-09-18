/**
 * Instagram publishable composer — caption + storyboard/card planning.
 * Migrated to approved-asset Channel Editor path (buildChannelComposerPromptParts).
 * Does NOT generate images; visual fields are planning metadata only.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableInstagramCardPlan,
  type PublishableInstagramMeta,
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
import { composeInstagramPublishableDeterministic } from "@/lib/marketing/publishable/instagram/deterministicInstagram";
import { INSTAGRAM_WRITING_CONTRACT } from "@/lib/marketing/publishable/instagram/writingContract";
import {
  stableSocialVisualId,
  type InstagramVisualMode,
} from "@/lib/marketing/publishable/socialVisualPlan";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  INSTAGRAM_HASHTAG_MAX,
  extractInstagramHashtags,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

const SLIDE_HEADLINE_MAX_CHARS = 28;
const SLIDE_MIN = 4;
const SLIDE_MAX = 10;

function buildInstagramPrompt(
  input: PublishableComposerInput,
  repairHint?: string | null,
): ChannelComposerPromptParts {
  return buildChannelComposerPromptParts({
    channel: "instagram",
    writingContract: [
      INSTAGRAM_WRITING_CONTRACT,
      formatCorePackPromptBlock(input),
      formatQualityRevisionPromptBlock(
        input.qualityRevision,
        input.storyLock?.editorialArchetype,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    composerInput: input,
    repairHint,
  });
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

function normalizeCardPlan(
  raw: unknown,
  fallbackHeadlines: string[],
): PublishableInstagramCardPlan[] | undefined {
  const cards: PublishableInstagramCardPlan[] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < Math.min(SLIDE_MAX, raw.length); i++) {
      const row = raw[i];
      if (!row || typeof row !== "object") continue;
      const c = row as Record<string, unknown>;
      const headline =
        typeof c.headline === "string" ? stripEvidenceIdsFromText(c.headline).slice(0, 80) : "";
      if (!headline) continue;
      const roleRaw = typeof c.role === "string" ? c.role : "";
      const role: PublishableInstagramCardPlan["role"] =
        roleRaw === "cover" ||
        roleRaw === "information" ||
        roleRaw === "evidence" ||
        roleRaw === "cta"
          ? roleRaw
          : i === 0
            ? "cover"
            : "information";
      const visualIntent =
        typeof c.visualIntent === "string"
          ? stripEvidenceIdsFromText(c.visualIntent).slice(0, 400)
          : "";
      const evidenceRefs = asStringArray(c.evidenceRefs, 8);
      let visual: PublishableInstagramCardPlan["visual"];
      if (c.visual && typeof c.visual === "object") {
        const v = c.visual as Record<string, unknown>;
        const visualId =
          typeof v.visualId === "string" && /^social_visual_\d{2,}$/.test(v.visualId.trim())
            ? v.visualId.trim()
            : stableSocialVisualId(i + 1);
        const mode =
          typeof v.visualMode === "string" && v.visualMode.trim()
            ? (stripEvidenceIdsFromText(v.visualMode).slice(0, 64) as InstagramVisualMode | string)
            : "typography";
        visual = {
          visualId,
          visualMode: mode,
          generatedVisualNeeded: Boolean(v.generatedVisualNeeded),
          reusableOnThreads: Boolean(v.reusableOnThreads),
          visualIntent:
            typeof v.visualIntent === "string"
              ? stripEvidenceIdsFromText(v.visualIntent).slice(0, 400)
              : visualIntent,
        };
      }
      cards.push({
        cardId:
          typeof c.cardId === "string" && c.cardId.trim()
            ? c.cardId.trim().slice(0, 64)
            : `card-${String(i + 1).padStart(2, "0")}`,
        role,
        headline,
        body: typeof c.body === "string" ? stripEvidenceIdsFromText(c.body).slice(0, 400) : "",
        visualIntent,
        evidenceRefs,
        visual,
      });
    }
  }

  if (cards.length === 0 && fallbackHeadlines.length >= SLIDE_MIN) {
    return fallbackHeadlines.slice(0, SLIDE_MAX).map((headline, i) => ({
      cardId: `card-${String(i + 1).padStart(2, "0")}`,
      role: (i === 0 ? "cover" : "information") as PublishableInstagramCardPlan["role"],
      headline,
      body: "",
      visualIntent: "",
      evidenceRefs: [],
    }));
  }

  return cards.length >= SLIDE_MIN ? cards : undefined;
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
    const cardPlan = normalizeCardPlan(parsed.cardPlan, slideHeadlines);
    const headlinesFromPlan = cardPlan?.map((c) => c.headline) ?? [];
    const resolvedHeadlines =
      headlinesFromPlan.length >= SLIDE_MIN
        ? headlinesFromPlan
        : slideHeadlines.length
          ? slideHeadlines
          : [];

    const declaredHashtags = asStringArray(parsed.hashtags, INSTAGRAM_HASHTAG_MAX).map((tag) =>
      tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`,
    );
    const hashtags = declaredHashtags.length ? declaredHashtags : extractInstagramHashtags(body);

    const hook =
      typeof parsed.hook === "string" && parsed.hook.trim()
        ? stripEvidenceIdsFromText(parsed.hook)
        : body.split(/\n/)[0] ?? "";

    const aspectRatio = parsed.aspectRatio === "1:1" ? "1:1" : "4:5";

    return {
      body,
      meta: {
        hook,
        hashtags,
        slideHeadlines: resolvedHeadlines,
        cta: typeof parsed.cta === "string" && parsed.cta.trim() ? stripEvidenceIdsFromText(parsed.cta) : null,
        altText:
          typeof parsed.altText === "string" && parsed.altText.trim()
            ? stripEvidenceIdsFromText(parsed.altText)
            : null,
        aspectRatio,
        cardPlan,
      },
    };
  } catch {
    return null;
  }
}

/** Slide overlays must fit the card; prefer smallest sufficient count. */
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
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
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
      compositionMode,
      inputAuthorityVersion: input.composerInput.approvedCanonicalAsset
        ? CHANNEL_INPUT_AUTHORITY_VERSION
        : null,
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
      buildPrompt: (hint) => buildInstagramPrompt(input.composerInput, hint),
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
