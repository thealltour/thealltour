import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type {
  AssignmentEvidenceRef,
  ContentDeliverableRequirements,
  ContentPlan,
  EvidencePack,
} from "@/lib/marketing/content/types";
import { packHasAllowedFactualItems } from "@/lib/marketing/content/evidencePack";

export type CompletenessFailureCode =
  | "missing_destination"
  | "missing_section"
  | "missing_text_draft"
  | "missing_content_plan"
  | "missing_source_references";

export type CompletenessFailure = {
  code: CompletenessFailureCode;
  message: string;
  detail?: string;
};

export type CompletenessValidationResult = {
  ok: boolean;
  failures: CompletenessFailure[];
  revisionHints: string[];
  /** Draft with sourceReferences projected from cited evidence when needed. */
  draft: ContentStrategistOutput;
  coveredDestinations: string[];
  missingDestinations: string[];
};

function normalizeHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function destinationCovered(destination: string, haystack: string): boolean {
  const needle = destination.trim().toLowerCase();
  if (needle.length < 2) return true;
  return haystack.includes(needle);
}

function sectionCovered(section: string, draft: ContentStrategistOutput, plan: ContentPlan | null): boolean {
  const label = section.trim().toLowerCase();
  if (!label) return true;
  const planOutline = (plan?.outline ?? []).map((s) => s.toLowerCase());
  if (planOutline.some((line) => line.includes(label) || label.includes(line.slice(0, Math.min(24, line.length))))) {
    return true;
  }
  const hay = normalizeHaystack([draft.title, draft.body, plan?.keyMessage, plan?.hook, ...(plan?.outline ?? [])]);
  const token = label.split(/\s+/).find((t) => t.length >= 4) ?? label.slice(0, 12);
  return token.length >= 2 && hay.includes(token);
}

function evidenceIdFromRef(ref: AssignmentEvidenceRef | string): string {
  return typeof ref === "string" ? ref : ref.evidenceId;
}

function urlOrIdFromPack(
  id: string,
  pack: EvidencePack | null | undefined,
): string {
  const full = pack?.availableEvidenceRefs.find((r) => r.evidenceId === id);
  if (full?.url?.trim()) return full.url.trim();
  return id;
}

/**
 * Project contentPlan.evidenceRefs into draft.sourceReferences when factual pack evidence exists.
 * Never invents URLs — only uses cited ref url/evidenceId or pack refs.
 */
export function projectSourceReferences(input: {
  draft: ContentStrategistOutput;
  evidencePack?: EvidencePack | null;
}): ContentStrategistOutput {
  const existing = (input.draft.sourceReferences ?? []).map(String).filter((s) => s.trim());
  if (existing.length > 0) {
    return { ...input.draft, sourceReferences: existing };
  }

  const planRefs = input.draft.contentPlan?.evidenceRefs ?? [];
  if (!planRefs.length) return { ...input.draft, sourceReferences: existing };

  const projected = planRefs
    .map((ref) => {
      const cited = ref as AssignmentEvidenceRef | string;
      if (typeof cited !== "string") {
        if (cited.url?.trim()) return cited.url.trim();
        if (cited.evidenceId?.trim()) return cited.evidenceId.trim();
      }
      return urlOrIdFromPack(evidenceIdFromRef(cited), input.evidencePack);
    })
    .filter(Boolean);
  const unique = [...new Set(projected)].slice(0, 12);
  return { ...input.draft, sourceReferences: unique };
}

export function validateContentCompleteness(input: {
  draft: ContentStrategistOutput;
  requirements: ContentDeliverableRequirements | null | undefined;
  evidencePack?: EvidencePack | null;
  contentPlanScaffold?: ContentPlan | null;
}): CompletenessValidationResult {
  const projected = projectSourceReferences({
    draft: input.draft,
    evidencePack: input.evidencePack,
  });

  if (!input.requirements) {
    return {
      ok: true,
      failures: [],
      revisionHints: [],
      draft: projected,
      coveredDestinations: [],
      missingDestinations: [],
    };
  }

  const req = input.requirements;
  const failures: CompletenessFailure[] = [];
  let plan = projected.contentPlan ?? null;
  // Partial CS contentPlan (facts/evidence only) inherits scaffold outline for section checks.
  // Do not merge the full scaffold — that would invent evidenceRefs the model omitted.
  if (plan && (!plan.outline || plan.outline.length === 0) && input.contentPlanScaffold?.outline?.length) {
    plan = { ...plan, outline: input.contentPlanScaffold.outline };
  }
  const draftForChecks =
    plan && plan !== projected.contentPlan ? { ...projected, contentPlan: plan } : projected;

  const hay = normalizeHaystack([
    draftForChecks.title,
    draftForChecks.body,
    plan?.keyMessage,
    plan?.hook,
    ...(plan?.outline ?? []),
  ]);

  const coveredDestinations: string[] = [];
  const missingDestinations: string[] = [];
  for (const dest of req.requiredDestinations) {
    if (destinationCovered(dest, hay)) coveredDestinations.push(dest);
    else {
      missingDestinations.push(dest);
      failures.push({
        code: "missing_destination",
        message: `Required destination not covered in draft: ${dest}`,
        detail: dest,
      });
    }
  }

  if (req.requiredOutputKinds.includes("text_draft") && !draftForChecks.body?.trim()) {
    failures.push({
      code: "missing_text_draft",
      message: "text_draft is required but draft.body is empty",
    });
  }

  if (req.requiredOutputKinds.includes("content_plan") && !plan) {
    failures.push({
      code: "missing_content_plan",
      message: "content_plan is required but draft.contentPlan is missing",
    });
  }

  if (plan) {
    for (const section of req.requiredSections) {
      if (!sectionCovered(section, draftForChecks, plan)) {
        failures.push({
          code: "missing_section",
          message: `Required section not reflected: ${section}`,
          detail: section,
        });
      }
    }
  }

  const factualRequired =
    req.requireSourceReferencesWhenFactual || packHasAllowedFactualItems(input.evidencePack);
  const hasPlanEvidence = (plan?.evidenceRefs?.length ?? 0) > 0;
  const hasSourceRefs = (draftForChecks.sourceReferences?.length ?? 0) > 0;
  if (factualRequired && !hasSourceRefs && !hasPlanEvidence) {
    failures.push({
      code: "missing_source_references",
      message:
        "Factual evidence pack requires sourceReferences or contentPlan.evidenceRefs before human review",
    });
  }

  const revisionHints = failures.map((f) => {
    if (f.code === "missing_destination") {
      return `completeness: cover required destination "${f.detail}" explicitly in the draft body`;
    }
    if (f.code === "missing_section") {
      return `completeness: include required section "${f.detail}" in contentPlan.outline or body`;
    }
    if (f.code === "missing_source_references") {
      return "completeness: cite supplied evidence IDs in contentPlan.evidenceRefs (and sourceReferences)";
    }
    if (f.code === "missing_content_plan") {
      return "completeness: return a contentPlan object with the draft";
    }
    return `completeness: ${f.message}`;
  });

  return {
    ok: failures.length === 0,
    failures,
    revisionHints: revisionHints.slice(0, 8),
    draft: draftForChecks,
    coveredDestinations,
    missingDestinations,
  };
}
