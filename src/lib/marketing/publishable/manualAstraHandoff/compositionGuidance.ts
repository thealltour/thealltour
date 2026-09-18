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
    return "Detail-forward framing with enough environmental context to understand the subject; avoid an overly tight crop that leaves no quiet edge for overlay.";
  }
  if (family === "map_context" || mode === "map_context") {
    return "Clear geographic/context framing; keep labels out of the image (no baked map typography).";
  }
  if (family === "subject_detail") {
    return "Subject-forward editorial framing with restrained commercial tone; leave one quiet edge for Korean overlay text.";
  }
  if (family === "context_cover" || mode === "editorial_photo") {
    return "Strong primary subject/context, uncluttered composition, natural lighting; reserve a clean area for card headline overlay.";
  }
  return "Clean travel-editorial composition with a clear primary subject and restrained commercial tone.";
}

export function buildTextSafeArea(visual: SharedVisual): string {
  if (!hasInstagramUsage(visual.usages)) {
    return "Keep composition clean; no mandatory text overlay area (Threads-oriented usage).";
  }
  const family = normalizeRoleFamily(visual.role);
  if (family === "object_detail" || visual.visualMode === "object_or_detail") {
    return "Keep the central detail clear and leave one edge visually quiet for Korean card text.";
  }
  if (family === "context_cover" || family === "information") {
    return "Leave a clean upper-third area for Korean headline overlay; avoid placing critical faces/details under the expected text block.";
  }
  return "Preserve one clean region for Korean overlay text; do not bake any text into the image.";
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
