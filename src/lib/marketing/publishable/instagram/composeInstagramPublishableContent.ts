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
  INSTAGRAM_HASHTAG_MIN,
  extractInstagramHashtags,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

const SLIDE_HEADLINE_MAX_CHARS = 28;
const SLIDE_MIN = 4;
const SLIDE_MAX = 10;

/**
 * Models often put tags only in the `hashtags` JSON field while leaving `body` tag-free.
 * Publishability validates the caption body, so merge declared tags into body when missing.
 */
export function mergeInstagramHashtagsIntoBody(
  body: string,
  declaredHashtags: string[],
): { body: string; hashtags: string[] } {
  const normalize = (tag: string): string => {
    const trimmed = tag.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#+/, "")}`;
  };

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...extractInstagramHashtags(body), ...declaredHashtags]) {
    const tag = normalize(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length >= INSTAGRAM_HASHTAG_MAX) break;
  }

  const inBody = extractInstagramHashtags(body).map((tag) => tag.toLowerCase());
  const missing = merged.filter((tag) => !inBody.includes(tag.toLowerCase()));
  if (missing.length === 0) {
    return { body, hashtags: merged.length ? merged : extractInstagramHashtags(body) };
  }

  // Only append when the caption would otherwise fail the minimum hashtag gate.
  if (inBody.length >= INSTAGRAM_HASHTAG_MIN) {
    return { body, hashtags: merged.length ? merged : extractInstagramHashtags(body) };
  }

  const nextBody = `${body.trimEnd()}\n\n${missing.join(" ")}`;
  return {
    body: nextBody,
    hashtags: extractInstagramHashtags(nextBody).slice(0, INSTAGRAM_HASHTAG_MAX),
  };
}

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

function asExplicitBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "TRUE" || value === 1) return true;
  if (value === "false" || value === "FALSE" || value === 0) return false;
  return undefined;
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
        // Preserve explicit true/false. Missing → conservative false (prompt requires explicit field).
        const needed = asExplicitBoolean(v.generatedVisualNeeded) ?? false;
        const reusable = asExplicitBoolean(v.reusableOnThreads) ?? false;
        visual = {
          visualId,
          visualMode: mode,
          generatedVisualNeeded: needed,
          reusableOnThreads: reusable,
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
    const merged = mergeInstagramHashtagsIntoBody(body, declaredHashtags);

    const hook =
      typeof parsed.hook === "string" && parsed.hook.trim()
        ? stripEvidenceIdsFromText(parsed.hook)
        : merged.body.split(/\n/)[0] ?? "";

    const aspectRatio = parsed.aspectRatio === "1:1" ? "1:1" : "4:5";

    return {
      body: merged.body,
      meta: {
        hook,
        hashtags: merged.hashtags,
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
  /**
   * Default true when approved Canonical is present and invoke is supplied.
   * Legacy single-shot channel-editor-instagram remains for tests / no-asset paths.
   */
  useEditorialSplit?: boolean;
  /** Persist editorial artifacts when set. */
  packageRoot?: string | null;
  /** Reserved for parity with other channel composers (Instagram pipeline does not package-reuse). */
  forceRegenerate?: boolean;
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

  const preferEditorialSplit =
    input.useEditorialSplit !== false &&
    (input.useEditorialSplit === true || Boolean(input.packageRoot)) &&
    Boolean(input.invoke) &&
    Boolean(input.composerInput.approvedCanonicalAsset);

  if (preferEditorialSplit && input.invoke) {
    const { runInstagramEditorialPipeline } = await import(
      "@/lib/marketing/publishable/instagramEditorial/pipeline"
    );
    const result = await runInstagramEditorialPipeline({
      composerInput: input.composerInput,
      invoke: input.invoke,
      now: input.now,
      modelProfile: input.modelProfile,
      packageRoot: input.packageRoot,
      narrativePlan: input.composerInput.editorialNarrativePlan,
    });
    // Fail-closed: do not quietly fall back to caption/slide heuristics.
    return result.content;
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
