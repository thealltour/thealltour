import { createHash, randomUUID } from "node:crypto";

import type { CreateSelectedAgendaInput, SelectedAgenda } from "@/lib/marketing/content/types";
import { SELECTED_AGENDA_CONTRACT } from "@/lib/marketing/content/types";

function resolveCommercialIntent(
  input: CreateSelectedAgendaInput,
): SelectedAgenda["commercialIntent"] {
  if (input.commercialIntent) return input.commercialIntent;
  if ((input.matchedProductIds?.length ?? 0) > 0) return "mixed";
  return "informational";
}

export function buildSelectedAgendaIdempotencyKey(input: CreateSelectedAgendaInput): string {
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  const seed = [
    input.title.trim().toLowerCase(),
    input.agendaCandidateId ?? "",
    input.researchBriefId ?? "",
    (input.destinations ?? []).join(","),
  ].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function createSelectedAgenda(input: CreateSelectedAgendaInput): SelectedAgenda {
  const now = input.now ?? new Date();
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (!title) throw new Error("selected_agenda_title_required");
  if (!summary) throw new Error("selected_agenda_summary_required");

  const idempotencyKey = buildSelectedAgendaIdempotencyKey(input);

  return {
    contract: SELECTED_AGENDA_CONTRACT,
    id: `sa_${idempotencyKey.slice(0, 24)}`,
    decidedAt: now.toISOString(),
    title,
    summary,
    rationale: (input.rationale ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
    destinations: (input.destinations ?? []).slice(0, 8),
    topics: (input.topics ?? []).slice(0, 8),
    entities: (input.entities ?? []).slice(0, 12),
    contentObjective: input.contentObjective?.trim() || "inform_travelers",
    audienceHint: input.audienceHint?.trim() || null,
    commercialIntent: resolveCommercialIntent(input),
    matchedProductIds: (input.matchedProductIds ?? []).slice(0, 8),
    evidenceRefs: (input.evidenceRefs ?? []).slice(0, 12),
    constraints: (input.constraints ?? []).slice(0, 12),
    urgency: input.urgency ?? "normal",
    timelinessNote: input.timelinessNote?.trim() || null,
    provenance: {
      decidedBy: "marketing-manager",
      managerDecisionSource: input.managerDecisionSource ?? (input.agendaCandidateId ? "research_assisted" : "explicit"),
      researchScoreAtSelection: input.researchScoreAtSelection ?? null,
      agendaCandidateId: input.agendaCandidateId ?? null,
      researchBriefId: input.researchBriefId ?? null,
    },
  };
}

export function createSelectedAgendaWithFreshId(input: CreateSelectedAgendaInput): SelectedAgenda {
  const agenda = createSelectedAgenda(input);
  return { ...agenda, id: randomUUID() };
}
