/**
 * Deterministic presentation selection — allowed when Layout Director LLM fails.
 * Chooses layout only; never rewrites copy.
 */

import {
  assertFingerprintSourcesInclude,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";
import type { CardNewsRole } from "@/lib/marketing/assets/contracts";
import {
  CARD_PRESENTATION_PLAN_CONTRACT,
  CARD_LAYOUT_DIRECTOR_HERMES_PROFILE,
  type CardPresentation,
  type CardPresentationPlan,
  type CardPresentationTemplate,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";

export type PresentationCardInput = {
  cardId: string;
  /** Legacy brief role OR editorial carousel role string. */
  role: string;
  hasVisual: boolean;
  visualId?: string | null;
  visualMode?: string | null;
  visualPriority?: string | null;
  textSafeAreaHint?: string | null;
  /** Optional headline for architecture-detail heuristic. */
  headlineHint?: string | null;
};

function mapLegacyRole(role: string): string {
  return role.trim().toLowerCase();
}

function pickTemplate(card: PresentationCardInput): CardPresentationTemplate {
  const role = mapLegacyRole(card.role);
  const hasVisual = card.hasVisual;
  const headline = (card.headlineHint ?? "").toLowerCase();

  if (
    hasVisual &&
    (role === "hook_cover" || role === "cover" || role.includes("hook"))
  ) {
    return "cover_full_bleed";
  }
  if (
    hasVisual &&
    (role === "evidence_detail" ||
      card.visualMode === "object_or_detail" ||
      /nhà|trình|tường|흙다짐|건축|가옥|architecture|detail/i.test(headline))
  ) {
    return "evidence_detail";
  }
  if (hasVisual && (role === "evidence" || role.includes("evidence"))) {
    return "photo_top_story";
  }
  if (
    !hasVisual &&
    (role === "closing" || role === "cta" || role.includes("close") || role.includes("payoff"))
  ) {
    return "closing_insight";
  }
  if (!hasVisual) {
    return "text_statement";
  }
  if (role === "closing" || role === "cta") {
    return "photo_overlay_editorial";
  }
  // textSafeArea lower third → prefer photo_top (text bottom on solid) or overlay-bottom cover-like
  const safe = (card.textSafeAreaHint ?? "").toLowerCase();
  if (safe.includes("lower") || safe.includes("bottom")) {
    return "photo_top_story";
  }
  if (safe.includes("upper") || safe.includes("top")) {
    return "photo_bottom_story";
  }
  return "photo_top_story";
}

function presentationForCard(card: PresentationCardInput): CardPresentation {
  const template = pickTemplate(card);
  const role = mapLegacyRole(card.role);

  switch (template) {
    case "cover_full_bleed":
      return {
        cardId: card.cardId,
        template,
        visualId: card.visualId ?? null,
        imagePlacement: "full",
        imageHeightRatio: 1,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "overlay-bottom",
        overlayMode: "gradient_dark",
        textDensity: "compact",
      };
    case "evidence_detail":
      return {
        cardId: card.cardId,
        template,
        visualId: card.visualId ?? null,
        imagePlacement: "top",
        imageHeightRatio: 0.5,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "bottom",
        overlayMode: "none",
        textDensity: "compact",
      };
    case "photo_bottom_story":
      return {
        cardId: card.cardId,
        template,
        visualId: card.visualId ?? null,
        imagePlacement: "bottom",
        imageHeightRatio: 0.52,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "top",
        overlayMode: "none",
        textDensity: "standard",
      };
    case "photo_overlay_editorial":
      return {
        cardId: card.cardId,
        template,
        visualId: card.visualId ?? null,
        imagePlacement: "full",
        imageHeightRatio: 1,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "overlay-bottom",
        overlayMode: "gradient_dark",
        textDensity: "compact",
      };
    case "closing_insight":
      return {
        cardId: card.cardId,
        template,
        visualId: null,
        imagePlacement: "full",
        imageHeightRatio: 0,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "bottom",
        overlayMode: "none",
        textDensity: role === "cta" ? "compact" : "standard",
      };
    case "text_statement":
      return {
        cardId: card.cardId,
        template,
        visualId: null,
        imagePlacement: "full",
        imageHeightRatio: 0,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "bottom",
        overlayMode: "none",
        textDensity: "minimal",
      };
    case "photo_top_story":
    default:
      return {
        cardId: card.cardId,
        template: "photo_top_story",
        visualId: card.visualId ?? null,
        imagePlacement: "top",
        imageHeightRatio: 0.48,
        cropMode: "cover",
        focalAlignment: "center",
        textPlacement: "bottom",
        overlayMode: "none",
        textDensity: "standard",
      };
  }
}

export function buildDeterministicCardPresentationPlan(input: {
  assetId: string;
  assetVersion: number;
  sourceInstagramFingerprint: string;
  sourceVisualPlanFingerprint?: string | null;
  cards: PresentationCardInput[];
  generatedAt?: string;
}): CardPresentationPlan {
  // Phase 3C: contract says deterministic_fallback; this function IS that path.
  assertCardPresentationArtifactContractParity();
  return {
    contract: CARD_PRESENTATION_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    cards: input.cards.map(presentationForCard),
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      sourceInstagramFingerprint: input.sourceInstagramFingerprint,
      sourceVisualPlanFingerprint: input.sourceVisualPlanFingerprint ?? null,
      modelProfile: `${CARD_LAYOUT_DIRECTOR_HERMES_PROFILE}:deterministic`,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
  };
}

/**
 * Phase 3C: Presentation production path = deterministic_fallback (Layout Hermes not wired).
 */
export function assertCardPresentationArtifactContractParity(): void {
  assertFingerprintSourcesInclude(CARD_PRESENTATION_PLAN_CONTRACT, [
    "provenance.sourceInstagramFingerprint",
    "provenance.sourceVisualPlanFingerprint",
  ]);
  requireOnGenerateFail(CARD_PRESENTATION_PLAN_CONTRACT, "deterministic_fallback");
  requireMaterializeInRepairLoop(CARD_PRESENTATION_PLAN_CONTRACT, false);
}

/** Map legacy CardNewsRole to presentation role hint. */
export function legacyRoleToPresentationHint(role: CardNewsRole): string {
  switch (role) {
    case "cover":
      return "hook_cover";
    case "evidence":
      return "evidence";
    case "cta":
      return "closing";
    default:
      return "context";
  }
}
