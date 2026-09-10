import type {
  ContentAssignment,
  ContentDeliverableRequirements,
  ContentPlan,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import { CONTENT_DELIVERABLE_REQUIREMENTS_CONTRACT } from "@/lib/marketing/content/types";

/**
 * Org v2 completeness contract. Default enabled; set MARKETING_COMPLETENESS_CONTRACT=false to skip.
 */
export function isCompletenessContractEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return String(env.MARKETING_COMPLETENESS_CONTRACT ?? "true").trim().toLowerCase() !== "false";
}

export function isEvidencePackEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return String(env.MARKETING_EVIDENCE_PACK ?? "true").trim().toLowerCase() !== "false";
}

export function isCompletenessValidatorEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return String(env.MARKETING_COMPLETENESS_VALIDATOR ?? "true").trim().toLowerCase() !== "false";
}

function normalizeSectionLabel(section: string): string {
  return section
    .replace(/\s*[—–-]\s*.*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build structural CS delivery requirements from MM handoff artifacts.
 * Empty destinations ⇒ no destination coverage requirement.
 */
export function buildDeliverableRequirements(input: {
  assignment: ContentAssignment;
  selectedAgenda: SelectedAgenda;
  contentPlanScaffold: ContentPlan;
  requireSourceReferencesWhenFactual?: boolean;
}): ContentDeliverableRequirements {
  const requiredDestinations = [
    ...new Set(
      (input.assignment.destinations.length
        ? input.assignment.destinations
        : input.selectedAgenda.destinations
      )
        .map((d) => d.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);

  const requiredSections = input.contentPlanScaffold.outline
    .map(normalizeSectionLabel)
    .filter(Boolean)
    .slice(0, 8);

  const requiredOutputKinds = [...input.assignment.requiredOutputs];
  const primaryFormatHint = input.assignment.formatHints[0]?.format ?? null;

  return {
    contract: CONTENT_DELIVERABLE_REQUIREMENTS_CONTRACT,
    assignmentId: input.assignment.assignmentId,
    requiredDestinations,
    requiredDestinationCount: requiredDestinations.length,
    requiredSections,
    requiredOutputKinds,
    primaryFormatHint,
    requireSourceReferencesWhenFactual: Boolean(input.requireSourceReferencesWhenFactual),
  };
}
