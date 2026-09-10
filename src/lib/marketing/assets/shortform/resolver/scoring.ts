import type { ShortVideoSceneRequirement } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE,
  SHORTFORM_RESOLVER_REUSE_BONUS_MAX,
  SHORTFORM_RESOLVER_REVIEW_MIN_SCORE,
  SHORTFORM_RESOLVER_SCORE_WEIGHTS,
} from "@/lib/marketing/assets/shortform/resolver/constants";
import type {
  ShortformFactualMatch,
  ShortformSourceCandidate,
  ShortformSourceScoreBreakdown,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import type { ShortformNormalizedHit } from "@/lib/marketing/assets/shortform/resolver/provider";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function tokenOverlapScore(queryTexts: string[], corpusTexts: string[]): number {
  const queryTokens = new Set(queryTexts.flatMap(tokenize));
  if (queryTokens.size === 0) return 0;
  const corpus = corpusTexts.flatMap(tokenize);
  if (corpus.length === 0) return 0;
  const corpusSet = new Set(corpus);
  let hit = 0;
  for (const token of queryTokens) {
    if (corpusSet.has(token)) hit += 1;
  }
  return clamp01(hit / queryTokens.size);
}

export function inferOrientation(
  width: number | null,
  height: number | null,
): "landscape" | "portrait" | "square" | "unknown" {
  if (width == null || height == null || width <= 0 || height <= 0) return "unknown";
  if (width === height) return "square";
  return height > width ? "portrait" : "landscape";
}

export function scoreNormalizedHit(input: {
  hit: ShortformNormalizedHit;
  scene: ShortVideoSceneRequirement;
  factualMatch: ShortformFactualMatch;
}): { score: number; breakdown: ShortformSourceScoreBreakdown } {
  const { hit, scene, factualMatch } = input;
  const queryTexts = [
    scene.visual.subject,
    ...scene.visual.searchQueries,
    scene.purpose,
  ];
  const corpus = [
    hit.titleOrSubject ?? "",
    ...hit.tags,
    hit.attributionText ?? "",
    hit.creatorName ?? "",
  ];

  const relevance = tokenOverlapScore(queryTexts, corpus);
  let mediaFit = 0.5;
  if (scene.visual.mediaPreference === "either") {
    mediaFit = hit.mediaType === "video" || hit.mediaType === "image" ? 1 : 0.2;
  } else if (scene.visual.mediaPreference === "video") {
    mediaFit =
      hit.mediaType === "video" ? 1 : hit.origin === "photo_motion" ? 0.7 : hit.mediaType === "image" ? 0.15 : 0.1;
  } else {
    mediaFit = hit.mediaType === "image" || hit.origin === "photo_motion" ? 1 : 0.35;
  }

  const orientation = hit.orientation ?? inferOrientation(hit.width, hit.height);
  const orientationFit =
    orientation === "portrait" ? 1 : orientation === "square" ? 0.55 : orientation === "landscape" ? 0.25 : 0.4;

  let durationFit = 0.6;
  if (hit.durationMs != null && hit.durationMs > 0) {
    const target = scene.targetDurationMs;
    const ratio = hit.durationMs / target;
    if (ratio >= 0.6 && ratio <= 2.5) durationFit = 1;
    else if (ratio >= 0.35 && ratio <= 4) durationFit = 0.65;
    else durationFit = 0.25;
  } else if (hit.mediaType === "image" || hit.origin === "photo_motion") {
    durationFit = 0.75;
  } else if (hit.mediaType === "generated_video_plan") {
    durationFit = 0.7;
  }

  let provenance = 0.4;
  if (hit.rightsKind === "owned" || hit.rightsKind === "partner_authorized") provenance = 1;
  else if (hit.rightsKind === "provider_license") provenance = 0.85;
  else if (hit.rightsKind === "generated") provenance = 0.55;
  else provenance = 0.15;

  if (factualMatch === "confirmed") provenance = Math.min(1, provenance + 0.05);
  if (factualMatch === "unknown" || factualMatch === "generic") {
    provenance = Math.min(provenance, 0.45);
  }

  let reuseBonus = 0;
  if (hit.origin === "internal_catalog") {
    const storage = hit.storageClassHint ?? "";
    if (storage === "local_master" || hit.rightsKind === "owned" || hit.rightsKind === "partner_authorized") {
      reuseBonus = SHORTFORM_RESOLVER_REUSE_BONUS_MAX;
    } else {
      reuseBonus = SHORTFORM_RESOLVER_REUSE_BONUS_MAX * 0.5;
    }
  }
  // Relevance gate: weak relevance kills reuse bonus
  if (relevance < 0.25) reuseBonus = 0;

  const w = SHORTFORM_RESOLVER_SCORE_WEIGHTS;
  const score = clamp01(
    relevance * w.relevance +
      mediaFit * w.mediaFit +
      orientationFit * w.orientationFit +
      durationFit * w.durationFit +
      provenance * w.provenance +
      reuseBonus * w.reuseBonus,
  );

  return {
    score,
    breakdown: {
      relevance: clamp01(relevance),
      mediaFit: clamp01(mediaFit),
      orientationFit: clamp01(orientationFit),
      durationFit: clamp01(durationFit),
      provenance: clamp01(provenance),
      reuseBonus: clamp01(reuseBonus),
    },
  };
}

export function applyEligibilityFlags(input: {
  candidate: Omit<
    ShortformSourceCandidate,
    "autoPickEligible" | "reviewRequired" | "rejectionReasons"
  > & { rejectionReasons?: string[] };
  scene: ShortVideoSceneRequirement;
}): ShortformSourceCandidate {
  const reasons = [...(input.candidate.rejectionReasons ?? [])];
  let autoPickEligible = true;
  let reviewRequired = false;

  if (reasons.length > 0) {
    autoPickEligible = false;
    reviewRequired = true;
  }

  if (input.candidate.rightsKind === "unknown") {
    autoPickEligible = false;
    reviewRequired = true;
    reasons.push("unknown_rights");
  }

  if (input.scene.visual.factualVisualRequired) {
    if (input.candidate.factualMatch === "generic" || input.candidate.factualMatch === "unknown") {
      autoPickEligible = false;
      reviewRequired = true;
      reasons.push("factual_match_insufficient");
    }
    if (input.candidate.factualMatch === "probable") {
      autoPickEligible = false;
      reviewRequired = true;
      reasons.push("factual_probable_requires_review");
    }
    if (input.candidate.origin === "generated_video_plan") {
      autoPickEligible = false;
      reviewRequired = true;
      reasons.push("generated_forbidden_for_factual");
    }
  }

  if (input.candidate.score < SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE) {
    autoPickEligible = false;
    if (input.candidate.score >= SHORTFORM_RESOLVER_REVIEW_MIN_SCORE) {
      reviewRequired = true;
      reasons.push("score_in_review_zone");
    } else {
      reasons.push("score_below_review_threshold");
    }
  }

  if (input.candidate.origin === "generated_video_plan") {
    autoPickEligible = false;
    reviewRequired = true;
    if (!reasons.includes("generated_plan_requires_explicit_commit")) {
      reasons.push("generated_plan_requires_explicit_commit");
    }
  }

  return {
    ...input.candidate,
    autoPickEligible,
    reviewRequired,
    rejectionReasons: [...new Set(reasons)],
  };
}
