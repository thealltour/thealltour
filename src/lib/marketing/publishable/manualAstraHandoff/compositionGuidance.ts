/**
 * Deterministic aspect / composition / text-safe guidance for Manual Astra handoff.
 */

import type { ManualAstraAspectRatio } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisual, SharedVisualUsage } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { normalizeRoleFamily } from "@/lib/marketing/publishable/sharedVisualPlan/normalize";

export function resolveAspectRatio(usages: SharedVisualUsage[]): ManualAstraAspectRatio {
  // v1 social_static: Instagram cardnews is 4:5; Threads reuses 4:5 for consistency.
  void usages;
  return "4:5";
}

export function hasInstagramUsage(usages: SharedVisualUsage[]): boolean {
  return usages.some((u) => u.channel === "instagram");
}

export function hasThreadsUsage(usages: SharedVisualUsage[]): boolean {
  return usages.some((u) => u.channel === "threads");
}

export function buildCompositionGuidance(visual: SharedVisual): string {
  const family = normalizeRoleFamily(visual.role);
  const mode = visual.visualMode;

  if (family === "object_detail" || mode === "object_or_detail") {
    return "Detail-forward framing with enough environmental context; keep primary texture in center/upper field and leave the lower third quiet for Korean overlay text.";
  }
  if (family === "map_context" || mode === "map_context") {
    return "Clear geographic/context framing; keep labels out of the image (no baked map typography).";
  }
  if (family === "subject_detail") {
    return "Subject-forward editorial framing with restrained commercial tone; keep primary subject center/upper and leave the lower third uncluttered for Korean overlay.";
  }
  if (family === "context_cover" || mode === "editorial_photo") {
    return "Strong primary subject/context in center/upper field, uncluttered composition, natural lighting; reserve a quiet lower third for large Korean headline/body overlay.";
  }
  return "Clean travel-editorial composition with a clear primary subject (center/upper) and a quiet lower third for Korean editorial overlay; restrained commercial tone.";
}

export function buildTextSafeArea(visual: SharedVisual): string {
  if (!hasInstagramUsage(visual.usages)) {
    return "Keep composition clean; no mandatory text overlay area (Threads-oriented usage).";
  }
  const family = normalizeRoleFamily(visual.role);
  const lowerThird =
    "Keep the lower third sufficiently uncluttered for a large Korean headline/body overlay. Avoid placing the primary subject or critical detail directly behind the lower text-safe region.";
  if (family === "object_detail" || visual.visualMode === "object_or_detail") {
    return `${lowerThird} Keep the central material/detail readable in the middle/upper frame; do not rely on the lower third for the primary texture.`;
  }
  if (family === "context_cover" || family === "information" || family === "subject_detail") {
    return `${lowerThird} Prefer primary subject/context in the center or upper field so the lower overlay band stays quiet.`;
  }
  return `${lowerThird} Do not bake any text, logo, or signage into the image.`;
}

export function batchConsistencyIntent(archetype: string | null | undefined): string {
  const discovery =
    archetype &&
    /discovery|cultural|curiosity|hidden|contrast|explainer/i.test(archetype);
  const base =
    "Calm, modern travel-editorial photography; natural realistic lighting; restrained commercial tone; coherent color/lighting mood across the set; clean composition suitable for Korean editorial overlay; no glossy tourism-brochure exaggeration.";
  if (discovery) {
    return `${base} Discovery/editorial tone — exploratory context and curiosity; avoid sales/booking or forced-choice imagery.`;
  }
  if (archetype && /practical|decision|worth_it|tradeoff/i.test(archetype)) {
    return `${base} Practical/decision stories may use clear comparison/context only when the visual intent requires it.`;
  }
  return base;
}
