import type { ContentAssignment, ContentPlan, SelectedAgenda } from "@/lib/marketing/content/types";
import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";

export function buildContentPlanScaffold(
  assignment: ContentAssignment,
  selectedAgenda: SelectedAgenda,
): ContentPlan {
  const topFormat = assignment.formatHints[0];
  const factsToUse = assignment.facts
    .filter((fact) => fact.confidence !== "low" && fact.evidenceRefs.length > 0)
    .map((fact) => fact.statement)
    .slice(0, 6);
  const factsToAvoid = assignment.facts
    .filter((fact) => fact.confidence === "low")
    .map((fact) => fact.statement)
    .slice(0, 4);

  const productLinkageStrategy =
    assignment.matchedProductIds.length > 0
      ? "Connect products only when naturally relevant; do not force ad tone."
      : "Informational content is valid without product linkage.";

  const ctaStrategy =
    assignment.commercialIntent === "commercial"
      ? "Soft CTA aligned to matched products; no fabricated offers."
      : assignment.commercialIntent === "mixed"
        ? "Optional product mention if evidence supports linkage."
        : "Informational CTA only — no hard sell.";

  return {
    contract: CONTENT_PLAN_CONTRACT,
    assignmentId: assignment.assignmentId,
    recommendedFormats: assignment.formatHints,
    primaryAngle: selectedAgenda.summary,
    keyMessage: selectedAgenda.title,
    targetAudience: assignment.audience ?? "travel-interested audience",
    hook: selectedAgenda.timelinessNote ?? selectedAgenda.title,
    outline: [
      "Context — why this matters now",
      "Key verified facts from assignment evidence",
      "Travel relevance for audience",
      assignment.matchedProductIds.length > 0 ? "Optional natural product connection" : "Useful takeaway without product",
      "CTA aligned to commercialIntent",
    ],
    factsToUse,
    factsToAvoid,
    ctaStrategy,
    productLinkageStrategy,
    evidenceRefs: assignment.evidenceRefs,
    requiredAssets: topFormat?.format === "instagram_carousel" ? ["destination imagery", "fact slides"] : [],
    riskNotes: assignment.riskNotes,
    draftInstructions: [
      `Preferred format hint: ${topFormat?.format ?? "threads_text"} (${topFormat?.rationale ?? "default"})`,
      "Use only factsToUse; do not expand beyond evidence.",
      "Do not change the manager-selected topic or agenda.",
      "Return contentPlan fields alongside text draft when possible.",
    ],
  };
}
