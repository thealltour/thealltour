/**
 * Assemble legacy PublishableChannelContent / InstagramMeta from editorial split artifacts.
 * Derives slideHeadlines for compatibility — new SoT is carousel + card-copy + caption.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableInstagramCardPlan,
  type PublishableInstagramMeta,
} from "@/lib/marketing/publishable/contracts";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildPropositionProvenance,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCaption,
  InstagramCardCopy,
  InstagramCarouselPlan,
  InstagramCarouselRole,
  InstagramVisualPriority,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { mergeInstagramHashtagsIntoBody } from "@/lib/marketing/publishable/instagram/hashtagMerge";
import {
  INSTAGRAM_HASHTAG_MAX,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

function mapCarouselRoleToLegacy(
  role: InstagramCarouselRole,
): PublishableInstagramCardPlan["role"] {
  switch (role) {
    case "hook_cover":
      return "cover";
    case "evidence":
    case "evidence_detail":
      return "evidence";
    case "cta":
      return "cta";
    default:
      return "information";
  }
}

/** Soft advisory only — not visual planning SoT (PR3 owns Shared Visual Director). */
function advisoryVisualIntent(input: {
  communicationGoal: string;
  visualPriority: InstagramVisualPriority;
  headline: string;
}): string {
  return stripEvidenceIdsFromText(
    `[visualPriority=${input.visualPriority}] ${input.communicationGoal} · ${input.headline}`,
  ).slice(0, 400);
}

export function deriveLegacySlideHeadlines(cardCopy: InstagramCardCopy): string[] {
  return cardCopy.cards.map((c) => stripEvidenceIdsFromText(c.headline).slice(0, 80));
}

export function assembleInstagramCardPlanFromEditorial(input: {
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
}): PublishableInstagramCardPlan[] {
  const copyById = new Map(input.cardCopy.cards.map((c) => [c.cardId, c]));
  return input.carousel.cards.map((card) => {
    const copy = copyById.get(card.cardId);
    const headline = stripEvidenceIdsFromText(copy?.headline ?? card.communicationGoal).slice(0, 80);
    const body = stripEvidenceIdsFromText(copy?.body ?? "").slice(0, 400);
    const evidenceRefs = copy?.evidenceRefs ?? [];
    const visualIntent = advisoryVisualIntent({
      communicationGoal: card.communicationGoal,
      visualPriority: card.visualPriority,
      headline,
    });
    // Intentionally omit visual.visualMode / generatedVisualNeeded / visualId —
    // those are no longer Instagram editorial SoT (Shared Visual Planner decides).
    return {
      cardId: card.cardId,
      role: mapCarouselRoleToLegacy(card.role),
      headline,
      body,
      visualIntent,
      evidenceRefs,
    };
  });
}

export function assembleInstagramMetaFromEditorial(input: {
  caption: InstagramCaption;
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
}): PublishableInstagramMeta {
  const cardPlan = assembleInstagramCardPlanFromEditorial({
    carousel: input.carousel,
    cardCopy: input.cardCopy,
  });
  const slideHeadlines = deriveLegacySlideHeadlines(input.cardCopy);
  const opening = stripEvidenceIdsFromText(input.caption.opening);
  const bodyCore = stripEvidenceIdsFromText(input.caption.body);
  const cta =
    input.caption.cta && input.caption.cta.trim()
      ? stripEvidenceIdsFromText(input.caption.cta)
      : null;
  const parts = [opening, bodyCore, cta].filter(Boolean);
  const captionWithoutTags = parts.join("\n\n");
  const merged = mergeInstagramHashtagsIntoBody(
    captionWithoutTags,
    input.caption.hashtags.slice(0, INSTAGRAM_HASHTAG_MAX),
  );

  return {
    hook: opening.slice(0, 200),
    hashtags: merged.hashtags,
    slideHeadlines,
    cta,
    altText: stripEvidenceIdsFromText(input.caption.altText).slice(0, 500),
    aspectRatio: "4:5",
    cardPlan,
  };
}

export function assemblePublishableInstagramFromEditorial(input: {
  composerInput: PublishableComposerInput;
  narrative: EditorialNarrativePlan;
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
  caption: InstagramCaption;
  nowIso: string;
  modelProfile?: string | null;
  attemptCount: number;
  latencyMs: number | null;
}): PublishableChannelContent {
  const meta = assembleInstagramMetaFromEditorial({
    caption: input.caption,
    carousel: input.carousel,
    cardCopy: input.cardCopy,
  });
  const opening = stripEvidenceIdsFromText(input.caption.opening);
  const bodyCore = stripEvidenceIdsFromText(input.caption.body);
  const cta = input.caption.cta?.trim()
    ? stripEvidenceIdsFromText(input.caption.cta)
    : null;
  const merged = mergeInstagramHashtagsIntoBody(
    [opening, bodyCore, cta].filter(Boolean).join("\n\n"),
    input.caption.hashtags,
  );
  const validation = validatePublishableText(merged.body, { channel: "instagram" });
  const publishableSuccess = validation.ok;
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");

  // Fingerprints retained for observability / stale chain (not on publishable contract).
  void buildEditorialNarrativeContentFingerprint(input.narrative);
  void buildInstagramCarouselContentFingerprint(input.carousel);
  void buildInstagramCardCopyContentFingerprint(input.cardCopy);

  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "instagram",
    format: "instagram_caption",
    title: null,
    body: merged.body,
    status: publishableSuccess ? "generated" : "validation_failed",
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: "llm",
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: "llm",
      modelProfile: input.modelProfile ?? "instagram-editorial-split",
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: publishableSuccess ? null : "publishability_validation",
      failureMessage: publishableSuccess
        ? null
        : validation.issues.map((i) => i.code).join(","),
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
    instagramMeta: meta,
    sourceAssetId: input.narrative.assetId,
    sourceAssetVersion: input.narrative.assetVersion,
  };
}

/** Build plannerInput.instagram.content.cards from editorial artifacts (SVP adapter). */
export function adaptEditorialToSharedVisualPlannerCards(input: {
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
}): Array<{
  cardId: string;
  role: string;
  headline: string;
  body: string;
  cardVisualIntent: string | null;
  visualPriority: InstagramVisualPriority;
}> {
  const copyById = new Map(input.cardCopy.cards.map((c) => [c.cardId, c]));
  return input.carousel.cards.map((card) => {
    const copy = copyById.get(card.cardId);
    return {
      cardId: card.cardId,
      role: card.role,
      headline: copy?.headline ?? card.communicationGoal,
      body: copy?.body ?? "",
      cardVisualIntent: advisoryVisualIntent({
        communicationGoal: card.communicationGoal,
        visualPriority: card.visualPriority,
        headline: copy?.headline ?? "",
      }),
      visualPriority: card.visualPriority,
    };
  });
}
