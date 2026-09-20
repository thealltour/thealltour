import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  NAVER_BAND_COPY_CONTRACT,
  NAVER_BAND_COPY_ENDING_INTENTS,
  NAVER_BAND_COPY_OPENING_INTENTS,
  NAVER_BAND_COPY_SPECIALIST_MAX_CHARS,
  NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
  type NaverBandCopyArtifact,
  type NaverBandCopyEndingIntent,
  type NaverBandCopyOpeningIntent,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export class NaverBandCopyMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NaverBandCopyMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NaverBandCopyMaterializeError("missing_field", `${field} required`);
  }
  return value.trim();
}

function isEndingIntent(value: unknown): value is NaverBandCopyEndingIntent {
  return (
    typeof value === "string" &&
    (NAVER_BAND_COPY_ENDING_INTENTS as readonly string[]).includes(value)
  );
}

function isOpeningIntent(value: unknown): value is NaverBandCopyOpeningIntent {
  return (
    typeof value === "string" &&
    (NAVER_BAND_COPY_OPENING_INTENTS as readonly string[]).includes(value)
  );
}

/** Forced Band engagement / sales CTA phrasing. */
export const FORCED_NAVER_BAND_CTA_RE =
  /댓글(?:로)?\s*(?:달아|남겨)|의견(?:을)?\s*남겨|저장하고\s*공유|공유해\s*보|다음\s*여행지로\s*추천|지금\s*예약|좋아요와\s*댓글/i;

/** Unsupported geographic / cultural generalizations. */
export const NAVER_BAND_UNSAFE_GENERALIZATION_RE =
  /남부\s*프레임|남부\s*베트남(?!\s*관광)|중부\s*도시권|관광지에선\s*볼\s*수\s*없는|관광\s*광고가\s*아니라|휴양\s*광고가\s*아니라|현지인의\s*진짜\s*삶|수백\s*년\s*(?:이어온|전통)|꼭\s*가봐야/i;

export function hasForcedNaverBandCta(body: string): boolean {
  return FORCED_NAVER_BAND_CTA_RE.test(body);
}

export function hasNaverBandUnsafeGeneralization(text: string): boolean {
  return NAVER_BAND_UNSAFE_GENERALIZATION_RE.test(text);
}

/** Reject near-verbatim Canonical reprints (long multi-paragraph copy of bodyKo). */
export function looksLikeCanonicalReprint(input: {
  body: string;
  canonicalBodyKo?: string | null;
}): boolean {
  const body = input.body.trim();
  const canon = (input.canonicalBodyKo ?? "").trim();
  if (!canon || canon.length < 100) return false;
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // Long contiguous chunk from Canonical appearing in Band body.
  const window = 90;
  for (let i = 0; i + window <= canon.length; i += 40) {
    const chunk = canon.slice(i, i + window);
    if (chunk.length >= window && body.includes(chunk)) {
      if (paragraphs.length >= 4 || body.length >= 550) return true;
    }
  }

  if (paragraphs.length >= 5 && body.length >= 700) {
    const sample = canon.slice(0, Math.min(120, canon.length));
    if (sample.length >= 80 && body.includes(sample.slice(0, 80))) {
      return true;
    }
  }
  return false;
}

export function materializeNaverBandCopy(input: {
  assetId: string;
  assetVersion: number;
  sourceNarrativeFingerprint: string;
  narrative: EditorialNarrativePlan;
  canonicalBodyKo?: string | null;
  modelProfile?: string;
  generatedAt?: string;
  llm: unknown;
}): NaverBandCopyArtifact {
  const root = asRecord(input.llm);
  if (!root) {
    throw new NaverBandCopyMaterializeError("invalid_llm", "Band copy LLM output must be an object");
  }

  const bodyRaw = requireNonEmptyString(root.body, "body");
  const body = stripEvidenceIdsFromText(bodyRaw);
  if (!body) {
    throw new NaverBandCopyMaterializeError("empty_body", "Band body empty after sanitize");
  }
  if (body.length > NAVER_BAND_COPY_SPECIALIST_MAX_CHARS) {
    throw new NaverBandCopyMaterializeError(
      "too_long",
      `Band body ${body.length} exceeds specialist max ${NAVER_BAND_COPY_SPECIALIST_MAX_CHARS}`,
    );
  }
  if (hasForcedNaverBandCta(body)) {
    throw new NaverBandCopyMaterializeError(
      "forced_cta",
      "Band body contains forced engagement/CTA phrasing",
    );
  }
  if (hasNaverBandUnsafeGeneralization(body)) {
    throw new NaverBandCopyMaterializeError(
      "unsafe_generalization",
      "Band body contains unsupported geographic/cultural generalization",
    );
  }
  if (looksLikeCanonicalReprint({ body, canonicalBodyKo: input.canonicalBodyKo })) {
    throw new NaverBandCopyMaterializeError(
      "canonical_reprint",
      "Band body looks like a Canonical reprint — compress to 2–3 key points",
    );
  }

  const titleRaw = root.title;
  const title =
    titleRaw == null || titleRaw === ""
      ? null
      : stripEvidenceIdsFromText(String(titleRaw));
  if (title && hasNaverBandUnsafeGeneralization(title)) {
    throw new NaverBandCopyMaterializeError(
      "unsafe_generalization",
      "Band title contains unsupported generalization",
    );
  }
  if (title && hasForcedNaverBandCta(title)) {
    throw new NaverBandCopyMaterializeError("forced_cta", "Band title contains forced CTA");
  }

  const validBeatIds = new Set(input.narrative.beats.map((b) => b.beatId));
  const selectedRaw = Array.isArray(root.selectedNarrativeBeats)
    ? root.selectedNarrativeBeats
    : Array.isArray(root.selected_narrative_beats)
      ? root.selected_narrative_beats
      : [];
  const selectedNarrativeBeats = selectedRaw
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());
  if (selectedNarrativeBeats.length < 1) {
    throw new NaverBandCopyMaterializeError(
      "beats_required",
      "selectedNarrativeBeats must include at least one beat",
    );
  }
  for (const beatId of selectedNarrativeBeats) {
    if (!validBeatIds.has(beatId)) {
      throw new NaverBandCopyMaterializeError("unknown_beat", `Unknown beatId: ${beatId}`);
    }
  }

  const openingRaw = root.openingIntent ?? root.opening_intent ?? "reframe";
  if (!isOpeningIntent(openingRaw)) {
    throw new NaverBandCopyMaterializeError("invalid_opening", "openingIntent invalid");
  }

  const endingRaw = root.endingIntent ?? root.ending_intent ?? "observation";
  if (!isEndingIntent(endingRaw)) {
    throw new NaverBandCopyMaterializeError("invalid_ending", "endingIntent invalid");
  }

  const keyPointsRaw = Array.isArray(root.keyPoints)
    ? root.keyPoints
    : Array.isArray(root.key_points)
      ? root.key_points
      : [];
  const keyPoints = keyPointsRaw
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => stripEvidenceIdsFromText(v))
    .slice(0, 4);
  if (keyPoints.length < 1) {
    throw new NaverBandCopyMaterializeError("keypoints_required", "keyPoints requires at least one item");
  }

  const engagementRaw = root.engagementIntent ?? root.engagement_intent;
  const engagementIntent =
    engagementRaw == null || engagementRaw === ""
      ? null
      : stripEvidenceIdsFromText(String(engagementRaw));
  if (engagementIntent && hasForcedNaverBandCta(engagementIntent)) {
    throw new NaverBandCopyMaterializeError(
      "forced_cta",
      "engagementIntent contains forced CTA phrasing",
    );
  }

  const evidenceRefs = Array.isArray(root.evidenceRefs)
    ? root.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : Array.isArray(root.evidence_refs)
      ? root.evidence_refs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];

  return {
    contract: NAVER_BAND_COPY_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    title,
    body,
    selectedNarrativeBeats,
    openingIntent: openingRaw,
    keyPoints,
    endingIntent: endingRaw,
    engagementIntent,
    evidenceRefs,
    sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile ?? NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    },
  };
}
