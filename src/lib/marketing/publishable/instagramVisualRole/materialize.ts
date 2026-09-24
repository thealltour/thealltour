import type { InstagramCarouselPlan } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_VISUAL_PRIORITIES } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  INSTAGRAM_VISUAL_DENSITIES,
  INSTAGRAM_VISUAL_GENERATION_PREFERENCES,
  INSTAGRAM_VISUAL_MODE_PREFERENCES,
  INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES,
  INSTAGRAM_VISUAL_REUSE_PREFERENCES,
  INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE,
  INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
  INSTAGRAM_VISUAL_ROLES,
  type InstagramVisualDensity,
  type InstagramVisualGenerationPreference,
  type InstagramVisualModePreference,
  type InstagramVisualPresentationPreference,
  type InstagramVisualReusePreference,
  type InstagramVisualRole,
  type InstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export class InstagramVisualRoleMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InstagramVisualRoleMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InstagramVisualRoleMaterializeError("missing_field", `${field} required`);
  }
  return value.trim();
}

function inEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** Reject VRA outputs that smuggle master-orchestration fields. */
export function assertNoMasterOrchestrationFields(root: Record<string, unknown>): void {
  if (typeof root.visualId === "string" && root.visualId.trim()) {
    throw new InstagramVisualRoleMaterializeError(
      "forbidden_field",
      "VRA must not emit visualId",
    );
  }
  if (Array.isArray(root.usages) && root.usages.length > 0) {
    throw new InstagramVisualRoleMaterializeError("forbidden_field", "VRA must not emit usages");
  }
  if (typeof root.masterVisualCount === "number" || typeof root.visualCount === "number") {
    throw new InstagramVisualRoleMaterializeError(
      "forbidden_field",
      "VRA must not emit master visual count",
    );
  }
  if (typeof root.template === "string" && root.template.trim()) {
    throw new InstagramVisualRoleMaterializeError(
      "forbidden_field",
      "VRA must not emit final layout template",
    );
  }
}

export function materializeInstagramVisualRolePlan(input: {
  assetId: string;
  assetVersion: number;
  sourceCarouselFingerprint: string;
  sourceCardCopyFingerprint: string;
  carousel: InstagramCarouselPlan;
  modelProfile?: string;
  generatedAt?: string;
  llm: unknown;
}): InstagramVisualRolePlan {
  const root = asRecord(input.llm);
  if (!root) {
    throw new InstagramVisualRoleMaterializeError("invalid_llm", "VRA LLM output must be an object");
  }
  assertNoMasterOrchestrationFields(root);

  const rhythmSummary = stripEvidenceIdsFromText(
    requireNonEmptyString(root.rhythmSummary ?? root.rhythm_summary, "rhythmSummary"),
  );

  const expectedIds = input.carousel.cards.map((c) => c.cardId);
  const cardsRaw = Array.isArray(root.cards) ? root.cards : null;
  if (!cardsRaw || cardsRaw.length !== expectedIds.length) {
    throw new InstagramVisualRoleMaterializeError(
      "card_mismatch",
      `cards must match carousel count (${expectedIds.length})`,
    );
  }

  const cards = cardsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new InstagramVisualRoleMaterializeError("invalid_card", `card ${index} invalid`);
    }
    assertNoMasterOrchestrationFields(row);
    const cardId = requireNonEmptyString(row.cardId ?? row.card_id, "cardId");
    if (cardId !== expectedIds[index]) {
      throw new InstagramVisualRoleMaterializeError(
        "card_order",
        `card order must follow carousel (expected ${expectedIds[index]}, got ${cardId})`,
      );
    }

    const visualRoleRaw = row.visualRole ?? row.visual_role;
    if (!inEnum(visualRoleRaw, INSTAGRAM_VISUAL_ROLES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_visual_role",
        `Invalid visualRole on ${cardId}: got ${JSON.stringify(visualRoleRaw)}`,
      );
    }
    const visualRole = visualRoleRaw as InstagramVisualRole;

    const visualPurpose = stripEvidenceIdsFromText(
      requireNonEmptyString(row.visualPurpose ?? row.visual_purpose, "visualPurpose"),
    );
    const priorityRaw = row.visualPriority ?? row.visual_priority ?? "useful";
    if (!inEnum(priorityRaw, INSTAGRAM_VISUAL_PRIORITIES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_priority",
        `Invalid visualPriority on ${cardId}`,
      );
    }

    const densityRaw = row.visualDensity ?? row.visual_density ?? "balanced";
    if (!inEnum(densityRaw, INSTAGRAM_VISUAL_DENSITIES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_density",
        `Invalid visualDensity on ${cardId}`,
      );
    }
    const visualDensity = densityRaw as InstagramVisualDensity;

    const modeRaw = row.visualModePreference ?? row.visual_mode_preference ?? "editorial_photo";
    if (!inEnum(modeRaw, INSTAGRAM_VISUAL_MODE_PREFERENCES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_mode_pref",
        `Invalid visualModePreference on ${cardId}`,
      );
    }
    const visualModePreference = modeRaw as InstagramVisualModePreference;

    const genRaw = row.generationPreference ?? row.generation_preference ?? "preferred";
    if (!inEnum(genRaw, INSTAGRAM_VISUAL_GENERATION_PREFERENCES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_generation_pref",
        `Invalid generationPreference on ${cardId}`,
      );
    }
    const generationPreference = genRaw as InstagramVisualGenerationPreference;

    const presentationRaw =
      row.presentationPreference ?? row.presentation_preference ?? "photo_top";
    if (!inEnum(presentationRaw, INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_presentation_pref",
        `Invalid presentationPreference on ${cardId}: got ${JSON.stringify(presentationRaw)}`,
      );
    }
    const presentationPreference = presentationRaw as InstagramVisualPresentationPreference;

    const reuseRaw = row.reusePreference ?? row.reuse_preference ?? "reusable";
    if (!inEnum(reuseRaw, INSTAGRAM_VISUAL_REUSE_PREFERENCES)) {
      throw new InstagramVisualRoleMaterializeError(
        "invalid_reuse_pref",
        `Invalid reusePreference on ${cardId}`,
      );
    }
    const reusePreference = reuseRaw as InstagramVisualReusePreference;

    const concreteVisualIntent = stripEvidenceIdsFromText(
      requireNonEmptyString(
        row.concreteVisualIntent ?? row.concrete_visual_intent,
        "concreteVisualIntent",
      ),
    );
    if (concreteVisualIntent.length < 12) {
      throw new InstagramVisualRoleMaterializeError(
        "weak_intent",
        `concreteVisualIntent too short on ${cardId}`,
      );
    }

    const evidenceRefs = Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : Array.isArray(row.evidence_refs)
        ? row.evidence_refs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [];

    return {
      cardId,
      visualRole,
      visualPurpose,
      visualPriority: priorityRaw,
      visualDensity,
      visualModePreference,
      generationPreference,
      presentationPreference,
      reusePreference,
      concreteVisualIntent,
      evidenceRefs,
    };
  });

  // All-card visual: every card must have a role treatment (already required).
  // Soft rhythm regression: reject identical role+presentation on every card when n>=3.
  if (cards.length >= 3) {
    const firstKey = `${cards[0]!.visualRole}|${cards[0]!.presentationPreference}`;
    if (cards.every((c) => `${c.visualRole}|${c.presentationPreference}` === firstKey)) {
      throw new InstagramVisualRoleMaterializeError(
        "flat_rhythm",
        "All cards share identical visualRole+presentationPreference — vary carousel rhythm",
      );
    }
  }

  return {
    contract: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    sourceCarouselFingerprint: input.sourceCarouselFingerprint,
    sourceCardCopyFingerprint: input.sourceCardCopyFingerprint,
    cards,
    rhythmSummary,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile ?? INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceCarouselFingerprint: input.sourceCarouselFingerprint,
      sourceCardCopyFingerprint: input.sourceCardCopyFingerprint,
    },
  };
}
