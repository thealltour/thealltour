import type { ShortVideoSceneRequirement } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import type { ShortformNormalizedHit } from "@/lib/marketing/assets/shortform/resolver/provider";
import type { ShortformFactualMatch } from "@/lib/marketing/assets/shortform/resolver/contracts";

export function hardRejectReasons(input: {
  hit: ShortformNormalizedHit;
  scene: ShortVideoSceneRequirement;
}): string[] {
  const reasons: string[] = [];
  const { hit, scene } = input;

  if (scene.visual.factualVisualRequired && hit.origin === "generated_video_plan") {
    reasons.push("generated_forbidden_for_factual");
  }
  if (
    scene.visual.factualVisualRequired === false &&
    hit.origin === "generated_video_plan" &&
    !scene.visual.generatedVideoAllowed
  ) {
    reasons.push("generated_not_allowed_by_scene");
  }
  if (hit.mediaType === "generated_video_plan" && !scene.visual.generatedVideoAllowed) {
    reasons.push("generated_not_allowed_by_scene");
  }

  if (scene.visual.mediaPreference === "video" && hit.mediaType === "image") {
    if (!(scene.visual.photoMotionAllowed && hit.origin === "photo_motion")) {
      reasons.push("image_rejected_for_video_preference");
    }
  }
  if (hit.origin === "photo_motion" && !scene.visual.photoMotionAllowed) {
    reasons.push("photo_motion_not_allowed");
  }

  if (hit.rightsKind === "generated" && !scene.visual.generatedVideoAllowed) {
    reasons.push("generated_rights_not_allowed");
  }

  return reasons;
}

export function inferFactualMatch(input: {
  hit: ShortformNormalizedHit;
  scene: ShortVideoSceneRequirement;
}): ShortformFactualMatch {
  if (input.hit.factualMatchHint) return input.hit.factualMatchHint;
  if (input.hit.origin === "generated_video_plan") return "generic";
  if (!input.scene.visual.factualVisualRequired) {
    return input.hit.origin === "internal_catalog" ? "probable" : "generic";
  }

  const subjectTokens = input.scene.visual.subject.toLowerCase();
  const corpus = [
    input.hit.titleOrSubject ?? "",
    ...input.hit.tags,
    ...input.scene.visual.searchQueries,
  ]
    .join(" ")
    .toLowerCase();

  const queries = input.scene.visual.searchQueries.map((q) => q.trim().toLowerCase()).filter(Boolean);
  if (queries.some((q) => q.length >= 4 && corpus.includes(q))) {
    return "confirmed";
  }
  if (subjectTokens.length >= 4 && corpus.includes(subjectTokens.slice(0, Math.min(subjectTokens.length, 40)))) {
    return "probable";
  }
  // Internal catalog with exact catalog subject metadata
  if (input.hit.origin === "internal_catalog" && input.hit.titleOrSubject) {
    const title = input.hit.titleOrSubject.toLowerCase();
    if (title && (subjectTokens.includes(title) || title.includes(subjectTokens.slice(0, 20)))) {
      return "probable";
    }
  }
  return "unknown";
}
