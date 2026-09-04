import { createHash, randomUUID } from "node:crypto";

import { buildStablePrefixedId } from "@/lib/marketing/content/stablePrefixedId";
import type { CreateSelectedAgendaInput, SelectedAgenda } from "@/lib/marketing/content/types";
import { SELECTED_AGENDA_CONTRACT } from "@/lib/marketing/content/types";

/** Deterministic default for productless informational travel content. */
export const DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE =
  "Korean travelers considering overseas travel";

function resolveCommercialIntent(
  input: CreateSelectedAgendaInput,
): SelectedAgenda["commercialIntent"] {
  if (input.commercialIntent) return input.commercialIntent;
  if ((input.matchedProductIds?.length ?? 0) > 0) return "mixed";
  return "informational";
}

function resolveAudienceHint(
  input: CreateSelectedAgendaInput,
  commercialIntent: SelectedAgenda["commercialIntent"],
): string | null {
  const explicit = input.audienceHint?.trim() || null;
  if (explicit) return explicit;
  if (commercialIntent === "informational") return DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE;
  return null;
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
  const commercialIntent = resolveCommercialIntent(input);

  return {
    contract: SELECTED_AGENDA_CONTRACT,
    id: buildStablePrefixedId("sa", idempotencyKey),
    decidedAt: now.toISOString(),
    title,
    summary,
    rationale: (input.rationale ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
    destinations: (input.destinations ?? []).slice(0, 8),
    topics: (input.topics ?? []).slice(0, 8),
    entities: (input.entities ?? []).slice(0, 12),
    contentObjective: input.contentObjective?.trim() || "inform_travelers",
    audienceHint: resolveAudienceHint(input, commercialIntent),
    commercialIntent,
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
