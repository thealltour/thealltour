/**
 * Role / mode / intent normalization for Shared Visual Planner.
 * Deterministic only — no LLM.
 */

import {
  SHARED_VISUAL_MODES,
  type SharedVisualMode,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

export type RoleFamily =
  | "context_cover"
  | "subject_detail"
  | "object_detail"
  | "map_context"
  | "evidence"
  | "fact"
  | "information"
  | "closing"
  | "contrast"
  | "unknown";

export function normalizeRoleFamily(role: string | null | undefined): RoleFamily {
  const r = (role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!r) return "unknown";
  if (/^(cover|cover_context|establishing)$/.test(r) || r.includes("establishing")) {
    return "context_cover";
  }
  if (/^(subject_detail|cultural_detail)$/.test(r) || r.includes("cultural")) {
    return "subject_detail";
  }
  if (
    /^(architecture_detail|object_detail|object_or_detail)$/.test(r) ||
    r.includes("architecture") ||
    r.includes("object")
  ) {
    return "object_detail";
  }
  if (/^(map|map_context|location_context)$/.test(r) || r.includes("map")) {
    return "map_context";
  }
  if (/^(evidence|evidence_context|evidence_boundary)$/.test(r) || r.includes("evidence")) {
    return "evidence";
  }
  if (/^(fact|fact_card)$/.test(r)) return "fact";
  if (/^(cta|minimal_closing|closing)$/.test(r)) return "closing";
  if (/^(simple_comparison|contrast|contrast_diagram)$/.test(r) || r.includes("contrast")) {
    return "contrast";
  }
  if (/^information$/.test(r)) return "information";
  return "unknown";
}

export function normalizeSharedVisualMode(
  raw: string | null | undefined,
): SharedVisualMode | undefined {
  const m = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!m) return undefined;
  if ((SHARED_VISUAL_MODES as readonly string[]).includes(m)) {
    return m as SharedVisualMode;
  }
  // Known aliases — do not pass through arbitrary strings.
  if (m === "photo" || m === "editorial") return "editorial_photo";
  if (m === "detail" || m === "object") return "object_or_detail";
  if (m === "infographic" || m === "icon") return "icon_infographic";
  if (m === "diagram" || m === "comparison_diagram") return "contrast_diagram";
  if (m === "map") return "map_context";
  if (m === "fact") return "fact_card";
  if (m === "evidence" || m === "boundary") return "evidence_boundary";
  if (m === "closing" || m === "minimal") return "minimal_closing";
  // typography / unknown → undefined (local-safe, not stored as free string)
  return undefined;
}

/** Meaningful tokens for intent overlap (Korean + Latin). */
export function tokenizeVisualIntent(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const stop = new Set([
    "a",
    "an",
    "the",
    "of",
    "and",
    "or",
    "to",
    "for",
    "with",
    "in",
    "on",
    "visual",
    "image",
    "photo",
    "show",
    "showing",
    "depict",
    "depicting",
    "있는",
    "없는",
    "하는",
    "되는",
    "위한",
    "같은",
    "다른",
  ]);
  return normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t))
    .slice(0, 48);
}

export function intentTokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(tokenizeVisualIntent(a));
  const tb = tokenizeVisualIntent(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t)) hits += 1;
  }
  return hits / Math.max(ta.size, tb.length);
}

/**
 * Threads mediaPlan visuals have no generatedVisualNeeded field.
 * Default true (external source visual expected); kept in a helper for future local-only modes.
 */
export function defaultThreadsGeneratedVisualNeeded(_input?: {
  role?: string;
  visualIntent?: string;
}): boolean {
  return true;
}

/** Local-renderable modes often do not need external Astra visuals. */
export function modeImpliesLocalRenderable(mode: SharedVisualMode | undefined): boolean {
  if (!mode) return false;
  return (
    mode === "icon_infographic" ||
    mode === "contrast_diagram" ||
    mode === "fact_card" ||
    mode === "evidence_boundary" ||
    mode === "minimal_closing"
  );
}
