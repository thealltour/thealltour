import { createHash } from "node:crypto";

import { buildAssignmentFacts, weakEvidenceRiskNotes } from "@/lib/marketing/content/evidence";
import { recommendContentFormats } from "@/lib/marketing/content/recommendContentFormats";
import { buildStablePrefixedId } from "@/lib/marketing/content/stablePrefixedId";
import type {
  ContentAssignment,
  CreateContentAssignmentInput,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import { CONTENT_ASSIGNMENT_CONTRACT } from "@/lib/marketing/content/types";

export function buildContentAssignmentIdempotencyKey(
  selectedAgenda: SelectedAgenda,
  override?: string,
): string {
  if (override?.trim()) return override.trim();
  const seed = [
    selectedAgenda.id,
    selectedAgenda.title.trim().toLowerCase(),
    selectedAgenda.provenance.agendaCandidateId ?? "",
    selectedAgenda.provenance.researchBriefId ?? "",
  ].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function createContentAssignment(input: CreateContentAssignmentInput): ContentAssignment {
  const now = input.now ?? new Date();
  const { selectedAgenda } = input;
  const idempotencyKey = buildContentAssignmentIdempotencyKey(selectedAgenda, input.idempotencyKey);
  const evidenceRefs = selectedAgenda.evidenceRefs.slice(0, 12);
  const facts = buildAssignmentFacts(evidenceRefs, selectedAgenda.summary);
  const riskNotes = [
    ...weakEvidenceRiskNotes(evidenceRefs),
    ...selectedAgenda.constraints.filter((item) => item.startsWith("risk:")),
  ].slice(0, 8);

  const formatHints = recommendContentFormats({
    commercialIntent: selectedAgenda.commercialIntent,
    destinations: selectedAgenda.destinations,
    factsCount: facts.length,
    evidenceRefs,
    urgency: selectedAgenda.urgency,
    channel: input.channel,
  });

  return {
    contract: CONTENT_ASSIGNMENT_CONTRACT,
    assignmentId: buildStablePrefixedId("ca", idempotencyKey),
    createdAt: now.toISOString(),
    selectedAgendaId: selectedAgenda.id,
    selectedAgendaTitle: selectedAgenda.title,
    objective: selectedAgenda.contentObjective,
    topic: selectedAgenda.title,
    audience: selectedAgenda.audienceHint,
    destinations: selectedAgenda.destinations,
    facts,
    commercialIntent: selectedAgenda.commercialIntent,
    matchedProductIds: selectedAgenda.matchedProductIds,
    constraints: [
      "do not invent product facts",
      "do not publish",
      "preserve assignment topic — do not re-select agenda",
      ...selectedAgenda.constraints,
    ].slice(0, 16),
    formatHints,
    requiredOutputs: ["content_plan", "text_draft"],
    deadline: null,
    evidenceRefs,
    riskNotes,
    provenance: {
      selectedAgendaId: selectedAgenda.id,
      createdBy: "marketing-manager-handoff",
      idempotencyKey,
    },
  };
}
