/**
 * Qualitative validation for Shared Visual Planner + Astra Handoff Writer outputs.
 * Governance only — does not change lifecycle or Worker authority model.
 */

import type { SharedVisualMode } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

const GENERIC_PHRASES = [
  "representational",
  "travel scenery",
  "travel image",
  "travel photo",
  "cultural visual",
  "nice landscape",
  "nice scenery",
  "destination image",
  "destination photo",
  "lifestyle photo",
  "context image",
  "generic visual",
  "atmosphere shot",
  "문화 비주얼",
  "여행 풍경",
  "풍경 사진",
];

/** Literal split / collage cues that conflict with editorial_photo. */
const LITERAL_SPLIT_RE =
  /\b(split[- ]?screen|split[- ]?frame|left\/right|side[- ]by[- ]side|diptych|collage|half[- ]and[- ]half)\b|왼쪽.{0,12}오른쪽|(beach|resort|해변).{0,24}(on the )?(left|right|한쪽)|beach\s+left|infographic[- ]like\s+comparison/i;

const DIAGRAM_IN_PHOTO_RE =
  /\b(infographic|diagram|comparison chart|그래픽 비교|도표|인포그래픽)\b/i;

/** Positive direction that depicts beach/resort as subject (not contrast foil mention). */
const BEACH_RESORT_SUBJECT_RE =
  /\b(show|depict|include|feature|featuring|with)\s+(a\s+)?(tropical\s+)?(beach|resort)\b|\b(tropical\s+beach|beach\s+resort|coastal\s+resort)\s+(scene|imagery|visual|shot|on the)\b|해변을?\s*(보여|담|배치)|리조트\s*(해변|풍경)을?\s*(보여|담)/i;

const BEACH_RESORT_NEGATIVE_RE =
  /\b(no|without|avoid|금지|피한다|제외).{0,48}(beach|resort|tropical|해변|리조트)|(beach|resort|tropical|해변|리조트).{0,40}(금지|피한다|제외|없어야)|no tropical beach|no beach or resort/i;

const TRANSITION_BOTH_SIDES_RE =
  /\btransition(?:ing)?\s+from\s+tropical\s+(?:beach|resort)[^.]*?\bto\b|\bfrom\s+(?:familiar\s+)?(?:beach|resort)[^.]*?\bto\s+(?:mountain|highland)/i;

const UNSUPPORTED_CULTURE_FILLER_RE =
  /\b(indigenous\s+botanical(?:\s+elements)?|authentic\s+village\s+life|local\s+lifestyle|traditional\s+people|documentary[- ]authentic|exotic\s+costume|ethnic\s+portrait)\b/gi;

export function isGenericVisualIntent(intent: string): boolean {
  const t = intent.trim();
  if (t.length < 24) return true;
  const lower = t.toLowerCase();
  for (const phrase of GENERIC_PHRASES) {
    if (lower === phrase || lower === `${phrase}.`) return true;
    if (new RegExp(`^${phrase.replace(/\s+/g, "\\s+")}\\.?$`, "i").test(t)) return true;
  }
  if (/^(representational|travel|scenery|문화|풍경|분위기)\s*$/i.test(t)) return true;
  return false;
}

export function isLiteralSplitScreenComposition(
  text: string,
  visualMode?: SharedVisualMode | null,
): boolean {
  if (visualMode === "contrast_diagram") return false;
  return LITERAL_SPLIT_RE.test(text);
}

export function isEditorialPhotoModeMismatch(
  text: string,
  visualMode?: SharedVisualMode | null,
): boolean {
  if (visualMode && visualMode !== "editorial_photo") return false;
  if (isLiteralSplitScreenComposition(text, visualMode)) return true;
  return DIAGRAM_IN_PHOTO_RE.test(text);
}

export function hasBeachResortContradiction(parts: {
  positiveText: string;
  negativeText?: string | null;
}): boolean {
  const pos = parts.positiveText;
  const neg = `${parts.negativeText ?? ""}`;
  const forbidsBeach = BEACH_RESORT_NEGATIVE_RE.test(neg) || BEACH_RESORT_NEGATIVE_RE.test(pos);
  const asksBeach =
    BEACH_RESORT_SUBJECT_RE.test(pos) ||
    TRANSITION_BOTH_SIDES_RE.test(pos) ||
    LITERAL_SPLIT_RE.test(pos);
  return forbidsBeach && asksBeach;
}

export function hasUnsupportedCultureFiller(text: string): boolean {
  return new RegExp(UNSUPPORTED_CULTURE_FILLER_RE.source, "i").test(text);
}

/**
 * Deterministic repair: drop beach/resort positive clauses when negatives forbid them,
 * and neutralize literal split-screen language for editorial_photo.
 */
export function repairContradictoryBriefText(input: {
  text: string;
  visualMode?: SharedVisualMode | null;
  evidenceConstraints?: string[] | null;
}): { text: string; repaired: boolean } {
  let text = input.text;
  let repaired = false;
  const negBlob = [...(input.evidenceConstraints ?? []), text].join(" ");
  const forbidsBeach = BEACH_RESORT_NEGATIVE_RE.test(negBlob);

  if (forbidsBeach && (TRANSITION_BOTH_SIDES_RE.test(text) || LITERAL_SPLIT_RE.test(text))) {
    // Prefer a single clean northern establishing reading over piecemeal clause surgery.
    const next =
      "Northern mountain highland establishing shot with calm atmospheric depth; no tropical beach or resort elements.";
    if (next !== text) {
      text = next;
      repaired = true;
    }
  } else if (forbidsBeach && BEACH_RESORT_SUBJECT_RE.test(text)) {
    const next = text
      .replace(BEACH_RESORT_SUBJECT_RE, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[,.\s]+/, "")
      .trim();
    if (next !== text) {
      text = next;
      repaired = true;
    }
  }

  if (
    !repaired &&
    (input.visualMode === "editorial_photo" || !input.visualMode) &&
    LITERAL_SPLIT_RE.test(text)
  ) {
    const next =
      "Single-frame northern mountain establishing atmosphere; uncluttered editorial composition.";
    if (next !== text) {
      text = next;
      repaired = true;
    }
  }

  if (hasUnsupportedCultureFiller(text)) {
    const next = text
      .replace(new RegExp(UNSUPPORTED_CULTURE_FILLER_RE.source, "gi"), "neutral environmental context")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (next !== text) {
      text = next;
      repaired = true;
    }
  }

  return { text, repaired };
}

export function assertPlannerVisualQuality(input: {
  role: string;
  visualIntent: string;
  visualMode?: SharedVisualMode;
  index: number;
}): void {
  const blob = `${input.role} ${input.visualIntent}`;
  if (isGenericVisualIntent(input.visualIntent)) {
    throw new Error(
      `generic_visual_intent:visual[${input.index}] visualIntent too generic: ${input.visualIntent}`,
    );
  }
  if (isEditorialPhotoModeMismatch(blob, input.visualMode ?? null)) {
    throw new Error(
      `literal_contrast_or_mode_mismatch:visual[${input.index}] editorial_photo must not use split-screen/diagram contrast`,
    );
  }
}

export type HandoffBriefQualityIssue = {
  code: string;
  message: string;
};

export function collectHandoffBriefQualityIssues(input: {
  visualId: string;
  visualMode?: SharedVisualMode | null;
  refinedVisualIntent: string;
  compositionGuidance: string;
  evidenceConstraints: string[];
}): HandoffBriefQualityIssue[] {
  const issues: HandoffBriefQualityIssue[] = [];
  const positive = `${input.refinedVisualIntent} ${input.compositionGuidance}`;
  const negative = input.evidenceConstraints.join(" ");

  if (isEditorialPhotoModeMismatch(positive, input.visualMode)) {
    issues.push({
      code: "mode_mismatch",
      message: `${input.visualId}: editorial_photo brief uses diagram/split composition`,
    });
  }
  if (
    hasBeachResortContradiction({
      positiveText: positive,
      negativeText: negative,
    })
  ) {
    issues.push({
      code: "brief_contradiction",
      message: `${input.visualId}: beach/resort positive conflicts with negative constraints`,
    });
  }
  if (hasUnsupportedCultureFiller(positive)) {
    issues.push({
      code: "unsupported_culture_filler",
      message: `${input.visualId}: unsupported culture filler wording`,
    });
  }
  return issues;
}
