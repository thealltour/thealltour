/**
 * Channel-agnostic Editorial Narrative Plan — shared SoT for channel composers.
 */

export {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
  EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
  NARRATIVE_BEAT_PURPOSES,
  type EditorialNarrativeBeat,
  type EditorialNarrativePlan,
  type EditorialNarrativePlanProvenance,
  type NarrativeBeatPurpose,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";

export {
  EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH,
  EDITORIAL_NARRATIVE_PLAN_MEDIA_TYPE,
} from "@/lib/marketing/publishable/editorialNarrative/paths";

export { buildCanonicalFingerprintForNarrative } from "@/lib/marketing/publishable/editorialNarrative/canonicalFingerprint";

export {
  dedupeEvidenceRefsForPrompt,
  type EvidenceRefForPromptDedup,
} from "@/lib/marketing/publishable/editorialNarrative/evidencePromptDedup";

export {
  ensureEditorialNarrativePlan,
  expectedEditorialNarrativeSourceFingerprint,
  type EnsureEditorialNarrativePlanResult,
  type EnsureEditorialNarrativePlanStatus,
} from "@/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan";
