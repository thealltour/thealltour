import {
  CARD_CROP_MODES,
  CARD_FOCAL_ALIGNMENTS,
  CARD_IMAGE_PLACEMENTS,
  CARD_OVERLAY_MODES,
  CARD_PRESENTATION_PLAN_CONTRACT,
  CARD_PRESENTATION_TEMPLATES,
  CARD_TEXT_DENSITIES,
  CARD_TEXT_PLACEMENTS,
  VISUAL_REQUIRED_TEMPLATES,
  type CardPresentation,
  type CardPresentationPlan,
  type CardPresentationTemplate,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";

export class CardPresentationMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CardPresentationMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CardPresentationMaterializeError("empty_field", `${field} required`);
  }
  return value.trim();
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | undefined,
): T | undefined {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new CardPresentationMaterializeError("invalid_enum", `${field} invalid: ${String(value)}`);
}

export function materializeCardPresentationPlan(input: {
  assetId: string;
  assetVersion: number;
  sourceInstagramFingerprint: string;
  sourceVisualPlanFingerprint?: string | null;
  modelProfile: string;
  generatedAt?: string;
  expectedCardIds: readonly string[];
  cardsWithVisual: ReadonlySet<string>;
  llm: unknown;
}): CardPresentationPlan {
  const root = asRecord(input.llm);
  if (!root) {
    throw new CardPresentationMaterializeError("invalid_llm", "Presentation LLM must be object");
  }
  const cardsRaw = root.cards;
  if (!Array.isArray(cardsRaw)) {
    throw new CardPresentationMaterializeError("cards_required", "cards[] required");
  }
  if (cardsRaw.length !== input.expectedCardIds.length) {
    throw new CardPresentationMaterializeError(
      "card_count_mismatch",
      `cards ${cardsRaw.length} != expected ${input.expectedCardIds.length}`,
    );
  }

  const expected = new Set(input.expectedCardIds);
  const seen = new Set<string>();
  const cards: CardPresentation[] = cardsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new CardPresentationMaterializeError("invalid_card", `card ${index} invalid`);
    }
    const cardId = requireString(row.cardId ?? row.card_id, "cardId");
    if (!expected.has(cardId)) {
      throw new CardPresentationMaterializeError("unexpected_card", `unexpected cardId ${cardId}`);
    }
    if (seen.has(cardId)) {
      throw new CardPresentationMaterializeError("duplicate_card", `duplicate ${cardId}`);
    }
    seen.add(cardId);

    const template = requireEnum(row.template, CARD_PRESENTATION_TEMPLATES, "template");
    const hasVisual = input.cardsWithVisual.has(cardId);
    if (VISUAL_REQUIRED_TEMPLATES.has(template) && !hasVisual) {
      throw new CardPresentationMaterializeError(
        "visual_template_without_visual",
        `${cardId} template ${template} requires visual`,
      );
    }

    let imageHeightRatio: number | undefined;
    if (typeof row.imageHeightRatio === "number" && Number.isFinite(row.imageHeightRatio)) {
      if (row.imageHeightRatio < 0 || row.imageHeightRatio > 1) {
        throw new CardPresentationMaterializeError(
          "image_ratio_bounds",
          `${cardId} imageHeightRatio out of 0–1`,
        );
      }
      imageHeightRatio = row.imageHeightRatio;
    }

    const visualId =
      typeof row.visualId === "string" && row.visualId.trim()
        ? row.visualId.trim()
        : row.visualId === null
          ? null
          : undefined;

    return {
      cardId,
      template: template as CardPresentationTemplate,
      ...(visualId !== undefined ? { visualId } : {}),
      imagePlacement: optionalEnum(row.imagePlacement, CARD_IMAGE_PLACEMENTS, undefined),
      ...(imageHeightRatio !== undefined ? { imageHeightRatio } : {}),
      cropMode: optionalEnum(row.cropMode, CARD_CROP_MODES, "cover"),
      focalAlignment: optionalEnum(row.focalAlignment, CARD_FOCAL_ALIGNMENTS, "center"),
      textPlacement: requireEnum(row.textPlacement, CARD_TEXT_PLACEMENTS, "textPlacement"),
      overlayMode: optionalEnum(row.overlayMode, CARD_OVERLAY_MODES, "none"),
      textDensity: requireEnum(row.textDensity, CARD_TEXT_DENSITIES, "textDensity"),
    };
  });

  for (const id of expected) {
    if (!seen.has(id)) {
      throw new CardPresentationMaterializeError("missing_card", `missing cardId ${id}`);
    }
  }

  const byId = new Map(cards.map((c) => [c.cardId, c]));
  const ordered = input.expectedCardIds.map((id) => byId.get(id)!);

  return {
    contract: CARD_PRESENTATION_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    cards: ordered,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      sourceInstagramFingerprint: input.sourceInstagramFingerprint,
      sourceVisualPlanFingerprint: input.sourceVisualPlanFingerprint ?? null,
      modelProfile: input.modelProfile,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
  };
}
