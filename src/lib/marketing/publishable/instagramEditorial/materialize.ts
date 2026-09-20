import {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
  NARRATIVE_BEAT_PURPOSES,
  type EditorialNarrativePlan,
  type NarrativeBeatPurpose,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
  INSTAGRAM_CAROUSEL_ROLES,
  INSTAGRAM_VISUAL_PRIORITIES,
  type InstagramCaption,
  type InstagramCardCopy,
  type InstagramCarouselPlan,
  type InstagramCarouselRole,
  type InstagramVisualPriority,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCaptionContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";

export class InstagramEditorialMaterializeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InstagramEditorialMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InstagramEditorialMaterializeError(
      "empty_field",
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isBeatPurpose(value: unknown): value is NarrativeBeatPurpose {
  return typeof value === "string" && (NARRATIVE_BEAT_PURPOSES as readonly string[]).includes(value);
}

function isCarouselRole(value: unknown): value is InstagramCarouselRole {
  return typeof value === "string" && (INSTAGRAM_CAROUSEL_ROLES as readonly string[]).includes(value);
}

function isVisualPriority(value: unknown): value is InstagramVisualPriority {
  return (
    typeof value === "string" &&
    (INSTAGRAM_VISUAL_PRIORITIES as readonly string[]).includes(value)
  );
}

function normalizeHashtag(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutHash = trimmed.replace(/^#+/, "");
  if (!withoutHash) return "";
  return `#${withoutHash.replace(/\s+/g, "")}`;
}

export function materializeEditorialNarrativePlan(input: {
  assetId: string;
  assetVersion: number;
  sourceCanonicalFingerprint: string;
  modelProfile: string;
  generatedAt?: string;
  editorialArchetype?: string | null;
  llm: unknown;
}): EditorialNarrativePlan {
  const root = asRecord(input.llm);
  if (!root) {
    throw new InstagramEditorialMaterializeError("invalid_llm", "Narrative LLM output must be an object");
  }

  const narrativePromise = requireNonEmptyString(
    root.narrativePromise ?? root.narrative_promise,
    "narrativePromise",
  );
  const audienceTakeaway = requireNonEmptyString(
    root.audienceTakeaway ?? root.audience_takeaway,
    "audienceTakeaway",
  );

  const beatsRaw = root.beats;
  if (!Array.isArray(beatsRaw) || beatsRaw.length < 2) {
    throw new InstagramEditorialMaterializeError(
      "beats_required",
      "Narrative plan requires at least 2 beats",
    );
  }

  const seenBeatIds = new Set<string>();
  const beats = beatsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new InstagramEditorialMaterializeError("invalid_beat", `Beat ${index} must be an object`);
    }
    const beatId = requireNonEmptyString(row.beatId ?? row.beat_id ?? `beat_${index + 1}`, "beatId");
    if (seenBeatIds.has(beatId)) {
      throw new InstagramEditorialMaterializeError("duplicate_beat_id", `Duplicate beatId: ${beatId}`);
    }
    seenBeatIds.add(beatId);
    const purposeRaw = row.purpose;
    if (!isBeatPurpose(purposeRaw)) {
      throw new InstagramEditorialMaterializeError(
        "invalid_purpose",
        `Beat ${beatId} has invalid purpose`,
      );
    }
    const message = requireNonEmptyString(row.message, "message");
    const evidenceRefs = Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : Array.isArray(row.evidence_refs)
        ? row.evidence_refs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : undefined;
    return {
      beatId,
      purpose: purposeRaw,
      message,
      ...(evidenceRefs && evidenceRefs.length > 0 ? { evidenceRefs } : {}),
    };
  });

  const plan: EditorialNarrativePlan = {
    contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    editorialArchetype: input.editorialArchetype ?? null,
    narrativePromise,
    audienceTakeaway,
    beats,
    sourceCanonicalFingerprint: input.sourceCanonicalFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
  };

  // Content fingerprint available for callers; not stored on plan body beyond source.
  void buildEditorialNarrativeContentFingerprint(plan);
  return plan;
}

export function materializeInstagramCarouselPlan(input: {
  assetId: string;
  assetVersion: number;
  sourceNarrativeFingerprint: string;
  modelProfile: string;
  generatedAt?: string;
  validBeatIds: ReadonlySet<string>;
  minCards: number;
  maxCards: number;
  llm: unknown;
}): InstagramCarouselPlan {
  const root = asRecord(input.llm);
  if (!root) {
    throw new InstagramEditorialMaterializeError("invalid_llm", "Carousel LLM output must be an object");
  }

  const cardsRaw = root.cards;
  if (!Array.isArray(cardsRaw)) {
    throw new InstagramEditorialMaterializeError("cards_required", "Carousel plan requires cards[]");
  }
  if (cardsRaw.length < input.minCards || cardsRaw.length > input.maxCards) {
    throw new InstagramEditorialMaterializeError(
      "card_count",
      `Carousel card count ${cardsRaw.length} outside ${input.minCards}–${input.maxCards}`,
    );
  }

  const seenCardIds = new Set<string>();
  const cards = cardsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new InstagramEditorialMaterializeError("invalid_card", `Card ${index} must be an object`);
    }
    const cardId = requireNonEmptyString(row.cardId ?? row.card_id ?? `card_${index + 1}`, "cardId");
    if (seenCardIds.has(cardId)) {
      throw new InstagramEditorialMaterializeError("duplicate_card_id", `Duplicate cardId: ${cardId}`);
    }
    seenCardIds.add(cardId);
    if (!isCarouselRole(row.role)) {
      throw new InstagramEditorialMaterializeError("invalid_role", `Card ${cardId} has invalid role`);
    }
    const beatIdsRaw = row.beatIds ?? row.beat_ids;
    if (!Array.isArray(beatIdsRaw) || beatIdsRaw.length < 1) {
      throw new InstagramEditorialMaterializeError(
        "beat_ids_required",
        `Card ${cardId} must reference at least one beat`,
      );
    }
    const beatIds = beatIdsRaw.map((id, i) => {
      if (typeof id !== "string" || !id.trim()) {
        throw new InstagramEditorialMaterializeError(
          "invalid_beat_ref",
          `Card ${cardId} beatIds[${i}] invalid`,
        );
      }
      const trimmed = id.trim();
      if (!input.validBeatIds.has(trimmed)) {
        throw new InstagramEditorialMaterializeError(
          "unknown_beat",
          `Card ${cardId} references unknown beat ${trimmed}`,
        );
      }
      return trimmed;
    });
    const communicationGoal = requireNonEmptyString(
      row.communicationGoal ?? row.communication_goal,
      "communicationGoal",
    );
    const visualPriorityRaw = row.visualPriority ?? row.visual_priority ?? "useful";
    if (!isVisualPriority(visualPriorityRaw)) {
      throw new InstagramEditorialMaterializeError(
        "invalid_visual_priority",
        `Card ${cardId} has invalid visualPriority`,
      );
    }
    return {
      cardId,
      role: row.role,
      beatIds,
      communicationGoal,
      visualPriority: visualPriorityRaw,
    };
  });

  const plan: InstagramCarouselPlan = {
    contract: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    cards,
    sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceUpstreamFingerprint: input.sourceNarrativeFingerprint,
    },
  };
  void buildInstagramCarouselContentFingerprint(plan);
  return plan;
}

export function materializeInstagramCardCopy(input: {
  assetId: string;
  assetVersion: number;
  sourceCarouselFingerprint: string;
  modelProfile: string;
  generatedAt?: string;
  expectedCardIds: readonly string[];
  llm: unknown;
}): InstagramCardCopy {
  const root = asRecord(input.llm);
  if (!root) {
    throw new InstagramEditorialMaterializeError("invalid_llm", "Card copy LLM output must be an object");
  }
  const cardsRaw = root.cards;
  if (!Array.isArray(cardsRaw)) {
    throw new InstagramEditorialMaterializeError("cards_required", "Card copy requires cards[]");
  }

  const expected = new Set(input.expectedCardIds);
  if (cardsRaw.length !== expected.size) {
    throw new InstagramEditorialMaterializeError(
      "card_count_mismatch",
      `Card copy count ${cardsRaw.length} != carousel ${expected.size}`,
    );
  }

  const seen = new Set<string>();
  const cards = cardsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new InstagramEditorialMaterializeError("invalid_card", `Copy card ${index} must be an object`);
    }
    const cardId = requireNonEmptyString(row.cardId ?? row.card_id, "cardId");
    if (!expected.has(cardId)) {
      throw new InstagramEditorialMaterializeError(
        "unexpected_card_id",
        `Card copy has unexpected cardId ${cardId}`,
      );
    }
    if (seen.has(cardId)) {
      throw new InstagramEditorialMaterializeError("duplicate_card_id", `Duplicate cardId: ${cardId}`);
    }
    seen.add(cardId);
    const headline = requireNonEmptyString(row.headline, "headline");
    const evidenceRefs = Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : undefined;
    return {
      cardId,
      ...(optionalString(row.kicker) ? { kicker: optionalString(row.kicker) } : {}),
      headline,
      ...(optionalString(row.body) ? { body: optionalString(row.body) } : {}),
      ...(optionalString(row.microcopy) ? { microcopy: optionalString(row.microcopy) } : {}),
      ...(evidenceRefs && evidenceRefs.length > 0 ? { evidenceRefs } : {}),
    };
  });

  for (const id of expected) {
    if (!seen.has(id)) {
      throw new InstagramEditorialMaterializeError("missing_card", `Card copy missing cardId ${id}`);
    }
  }

  // Preserve carousel order
  const byId = new Map(cards.map((c) => [c.cardId, c]));
  const ordered = input.expectedCardIds.map((id) => byId.get(id)!);

  const copy: InstagramCardCopy = {
    contract: INSTAGRAM_CARD_COPY_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    cards: ordered,
    sourceCarouselFingerprint: input.sourceCarouselFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceUpstreamFingerprint: input.sourceCarouselFingerprint,
    },
  };
  void buildInstagramCardCopyContentFingerprint(copy);
  return copy;
}

export function materializeInstagramCaption(input: {
  assetId: string;
  assetVersion: number;
  sourceCardCopyFingerprint: string;
  modelProfile: string;
  generatedAt?: string;
  hashtagMax: number;
  llm: unknown;
}): InstagramCaption {
  const root = asRecord(input.llm);
  if (!root) {
    throw new InstagramEditorialMaterializeError("invalid_llm", "Caption LLM output must be an object");
  }

  const opening = requireNonEmptyString(root.opening, "opening");
  const body = requireNonEmptyString(root.body, "body");
  const altText = requireNonEmptyString(root.altText ?? root.alt_text, "altText");
  const ctaRaw = root.cta;
  const cta =
    ctaRaw === null || ctaRaw === undefined
      ? null
      : typeof ctaRaw === "string" && ctaRaw.trim()
        ? ctaRaw.trim()
        : null;

  const hashtagsRaw = root.hashtags;
  if (!Array.isArray(hashtagsRaw)) {
    throw new InstagramEditorialMaterializeError("hashtags_required", "Caption requires hashtags[]");
  }
  const hashtags = hashtagsRaw
    .filter((v): v is string => typeof v === "string")
    .map(normalizeHashtag)
    .filter(Boolean)
    .slice(0, input.hashtagMax);

  const caption: InstagramCaption = {
    contract: INSTAGRAM_CAPTION_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    opening,
    body,
    cta,
    hashtags,
    altText,
    sourceCardCopyFingerprint: input.sourceCardCopyFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceUpstreamFingerprint: input.sourceCardCopyFingerprint,
    },
  };
  void buildInstagramCaptionContentFingerprint(caption);
  return caption;
}
