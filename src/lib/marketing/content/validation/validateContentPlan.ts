import type { ZodError } from "zod";

import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type {
  AssignmentEvidenceRef,
  AssignmentFact,
  ContentAssignment,
  ContentPlan,
} from "@/lib/marketing/content/types";
import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import {
  contentPlanCanonicalSchema,
  contentPlanProviderSchema,
  CONTENT_PLAN_MAX_EVIDENCE,
} from "@/lib/marketing/content/validation/contentPlanSchema";

export type ContentPlanValidationSource =
  | "provider_output"
  | "internal_scaffold"
  | "persisted"
  | "revision";

export type ProviderEvidencePresence = "absent" | "empty" | "present" | "malformed";

type ResolveContentPlanInput = {
  draft: ContentStrategistOutput;
  assignment?: ContentAssignment | null;
  effectivePlan: unknown;
  source: ContentPlanValidationSource;
};

function isProviderSource(source: ContentPlanValidationSource): boolean {
  return source === "provider_output" || source === "revision";
}

function incidentClassForSource(source: ContentPlanValidationSource): "malformed_model_output" | "invalid_state" {
  return isProviderSource(source) ? "malformed_model_output" : "invalid_state";
}

function zodToContractError(
  error: ZodError,
  source: ContentPlanValidationSource,
): ContentPlanContractError {
  const first = error.issues[0];
  const path = first?.path.join(".") ?? "root";
  const isOversized = first?.code === "too_big";
  const isWrongType = first?.code === "invalid_type";

  return new ContentPlanContractError({
    incidentClass: incidentClassForSource(source),
    validationIssue: isOversized ? "oversized_field" : isWrongType ? "wrong_primitive_type" : "schema_malformed",
    source,
    message: first?.message ?? "ContentPlan schema validation failed",
    zodPath: path,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getProviderEvidencePresence(raw: Record<string, unknown>): ProviderEvidencePresence {
  if (!("evidenceRefs" in raw)) return "absent";
  if (!Array.isArray(raw.evidenceRefs)) return "malformed";
  if (raw.evidenceRefs.length === 0) return "empty";
  return "present";
}

export function hasFactualClaimsFromPlan(factsToUse: string[]): boolean {
  return factsToUse.some((fact) => fact.trim().length >= 8);
}

function mergeEvidenceRefs(
  assignmentRefs: AssignmentEvidenceRef[],
  planRefs: AssignmentEvidenceRef[],
): AssignmentEvidenceRef[] {
  const merged: AssignmentEvidenceRef[] = [];
  const seen = new Set<string>();
  for (const ref of assignmentRefs) {
    if (seen.has(ref.evidenceId)) continue;
    seen.add(ref.evidenceId);
    merged.push(ref);
  }
  for (const ref of planRefs) {
    if (seen.has(ref.evidenceId)) continue;
    seen.add(ref.evidenceId);
    merged.push(ref);
  }
  return merged.slice(0, CONTENT_PLAN_MAX_EVIDENCE);
}

function providerShapeToCanonical(
  parsed: ReturnType<typeof contentPlanProviderSchema.parse>,
  evidenceRefs: AssignmentEvidenceRef[],
): ContentPlan {
  return {
    contract: CONTENT_PLAN_CONTRACT,
    assignmentId: parsed.assignmentId,
    recommendedFormats: parsed.recommendedFormats ?? [],
    primaryAngle: parsed.primaryAngle ?? "",
    keyMessage: parsed.keyMessage ?? "",
    targetAudience: parsed.targetAudience ?? "",
    hook: parsed.hook ?? "",
    outline: parsed.outline ?? [],
    factsToUse: parsed.factsToUse ?? [],
    factsToAvoid: parsed.factsToAvoid ?? [],
    ctaStrategy: parsed.ctaStrategy ?? "",
    productLinkageStrategy: parsed.productLinkageStrategy ?? "",
    evidenceRefs,
    requiredAssets: parsed.requiredAssets ?? [],
    riskNotes: parsed.riskNotes ?? [],
    draftInstructions: parsed.draftInstructions ?? [],
  };
}

/**
 * Legacy adapter: copy assignment evidence only when every factsToUse entry
 * deterministically maps to an assignment fact with linked evidence IDs.
 */
export function canSafelyAdaptLegacyEvidenceRefs(
  raw: Record<string, unknown>,
  assignment: ContentAssignment,
): boolean {
  if (!assignment.evidenceRefs.length) return false;

  const factsToUse = Array.isArray(raw.factsToUse)
    ? raw.factsToUse.map(String)
    : assignment.facts
        .filter((fact) => fact.confidence !== "low" && fact.evidenceRefs.length > 0)
        .map((fact) => fact.statement);

  if (!hasFactualClaimsFromPlan(factsToUse)) return true;

  const evidenceIds = new Set(assignment.evidenceRefs.map((ref) => ref.evidenceId));
  return factsToUse.every((factText) => {
    const matched = assignment.facts.find((fact) => fact.statement === factText);
    if (!matched) return false;
    return matched.evidenceRefs.some((id) => evidenceIds.has(id));
  });
}

function adaptLegacyContentPlan(
  raw: unknown,
  source: ContentPlanValidationSource,
  assignment?: ContentAssignment | null,
): unknown {
  if (raw === null || raw === undefined) return raw;
  if (!isRecord(raw)) return raw;

  const adapted: Record<string, unknown> = { ...raw };

  if (adapted.contract !== CONTENT_PLAN_CONTRACT && adapted.assignmentId) {
    adapted.contract = CONTENT_PLAN_CONTRACT;
  }

  if (!("evidenceRefs" in adapted) && (source === "internal_scaffold" || source === "persisted")) {
    if (!assignment) {
      throw new ContentPlanContractError({
        incidentClass: "invalid_state",
        validationIssue: "legacy_unsafe",
        source,
        message: "Legacy contentPlan missing evidenceRefs and no assignment provenance is available",
      });
    }
    if (!canSafelyAdaptLegacyEvidenceRefs(adapted, assignment)) {
      throw new ContentPlanContractError({
        incidentClass: "invalid_state",
        validationIssue: "legacy_unsafe",
        source,
        message:
          "Legacy contentPlan facts cannot be mapped safely to assignment provenance; refusing broad evidence copy",
      });
    }
    if (assignment.evidenceRefs.length > 0) {
      adapted.evidenceRefs = assignment.evidenceRefs;
    }
  }

  return adapted;
}

function assertProviderEvidenceSemantics(
  raw: Record<string, unknown>,
  factsToUse: string[],
  source: ContentPlanValidationSource,
): AssignmentEvidenceRef[] {
  const presence = getProviderEvidencePresence(raw);

  if (presence === "malformed") {
    throw new ContentPlanContractError({
      incidentClass: "malformed_model_output",
      validationIssue: "invalid_evidence_shape",
      source,
      message: "Provider contentPlan.evidenceRefs must be an array when present",
    });
  }

  const hasFactualClaims = hasFactualClaimsFromPlan(factsToUse);

  if (hasFactualClaims && presence === "absent") {
    throw new ContentPlanContractError({
      incidentClass: "malformed_model_output",
      validationIssue: "evidence_refs_absent",
      source,
      message: "Provider contentPlan has factual claims but evidenceRefs field is absent",
    });
  }

  if (hasFactualClaims && presence === "empty") {
    throw new ContentPlanContractError({
      incidentClass: "malformed_model_output",
      validationIssue: "evidence_refs_empty",
      source,
      message: "Provider contentPlan has factual claims but evidenceRefs is explicitly empty",
    });
  }

  if (presence === "absent" || presence === "empty") {
    return [];
  }

  return raw.evidenceRefs as AssignmentEvidenceRef[];
}

export function parseProviderContentPlan(
  raw: unknown,
  source: ContentPlanValidationSource = "provider_output",
): ContentPlan {
  if (!isRecord(raw)) {
    throw new ContentPlanContractError({
      incidentClass: "malformed_model_output",
      validationIssue: "wrong_primitive_type",
      source,
      message: "Provider contentPlan must be an object",
    });
  }

  const parsed = contentPlanProviderSchema.safeParse(raw);
  if (!parsed.success) {
    throw zodToContractError(parsed.error, source);
  }

  const factsToUse = parsed.data.factsToUse ?? [];
  const evidenceRefs = assertProviderEvidenceSemantics(raw, factsToUse, source);

  if (evidenceRefs.length > 0) {
    const evidenceValidated = contentPlanCanonicalSchema.shape.evidenceRefs.safeParse(evidenceRefs);
    if (!evidenceValidated.success) {
      throw zodToContractError(evidenceValidated.error, source);
    }
  }

  const canonical = providerShapeToCanonical(parsed.data, evidenceRefs);
  const validated = contentPlanCanonicalSchema.safeParse(canonical);
  if (!validated.success) {
    throw zodToContractError(validated.error, source);
  }
  return validated.data;
}

export function validateInternalContentPlan(
  raw: unknown,
  source: ContentPlanValidationSource,
  assignment?: ContentAssignment | null,
): ContentPlan {
  const adapted = adaptLegacyContentPlan(raw, source, assignment);
  const validated = contentPlanCanonicalSchema.safeParse(adapted);
  if (!validated.success) {
    throw zodToContractError(validated.error, source);
  }
  return validated.data;
}

export function planHasFactualClaims(contentPlan: ContentPlan, assignment?: ContentAssignment | null): boolean {
  return hasFactualClaimsFromPlan(contentPlan.factsToUse);
}

export function resolveEvidenceForGovernance(input: {
  contentPlan: ContentPlan;
  assignment?: ContentAssignment | null;
  draft: ContentStrategistOutput;
  source: ContentPlanValidationSource;
}): AssignmentEvidenceRef[] {
  const assignmentRefs = input.assignment?.evidenceRefs ?? [];
  const merged = mergeEvidenceRefs(assignmentRefs, input.contentPlan.evidenceRefs);
  const hasFactualClaims = planHasFactualClaims(input.contentPlan, input.assignment);

  if (hasFactualClaims && merged.length === 0) {
    throw new ContentPlanContractError({
      incidentClass: incidentClassForSource(input.source),
      validationIssue: "missing_evidence_for_factual_claims",
      source: input.source,
      message:
        "Factual claims are present but no valid evidence references could be resolved from assignment or contentPlan",
    });
  }

  return merged;
}

/**
 * Boundary 2: validate effective ContentPlan and resolve evidence before GA handoff.
 */
export function resolveContentPlanForGovernance(input: ResolveContentPlanInput): ContentPlan {
  const contentPlan =
    isProviderSource(input.source)
      ? parseProviderContentPlan(input.effectivePlan, input.source)
      : validateInternalContentPlan(input.effectivePlan, input.source, input.assignment);

  const evidenceRefs = resolveEvidenceForGovernance({
    contentPlan,
    assignment: input.assignment,
    draft: input.draft,
    source: input.source,
  });

  return { ...contentPlan, evidenceRefs };
}
