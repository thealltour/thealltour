import type { MarketingIncidentClass } from "@/lib/marketing/operations/incidentClassification";
import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";

export type ContentPlanValidationIssue =
  | "schema_malformed"
  | "wrong_primitive_type"
  | "oversized_field"
  | "oversized_array"
  | "missing_evidence_for_factual_claims"
  | "evidence_refs_absent"
  | "evidence_refs_empty"
  | "invalid_evidence_shape"
  | "legacy_unsafe"
  | "corrupted_internal_state";

export type ContentPlanValidationSource =
  | "provider_output"
  | "internal_scaffold"
  | "persisted"
  | "revision";

export class ContentPlanContractError extends Error {
  readonly name = "ContentPlanContractError";
  readonly contract = CONTENT_PLAN_CONTRACT;
  readonly failureStage = "content_plan_validation" as const;
  readonly incidentClass: MarketingIncidentClass;
  readonly validationIssue: ContentPlanValidationIssue;
  readonly source: ContentPlanValidationSource;
  readonly zodPath?: string;

  constructor(input: {
    incidentClass: MarketingIncidentClass;
    validationIssue: ContentPlanValidationIssue;
    source: ContentPlanValidationSource;
    message: string;
    zodPath?: string;
  }) {
    super(input.message);
    this.incidentClass = input.incidentClass;
    this.validationIssue = input.validationIssue;
    this.source = input.source;
    this.zodPath = input.zodPath;
  }

  toPipelineMessage(): string {
    return `content_plan_validation:${this.incidentClass}:${this.validationIssue}:${this.message}`;
  }
}
