import { buildContentPlanScaffold } from "@/lib/marketing/content/buildContentPlanScaffold";
import { createContentAssignment } from "@/lib/marketing/content/createContentAssignment";
import { createSelectedAgenda } from "@/lib/marketing/content/createSelectedAgenda";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import {
  getDefaultContentAssignmentStore,
  type ContentAssignmentStore,
} from "@/lib/marketing/content/store/contentAssignmentStore";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type {
  CreateSelectedAgendaInput,
  ManagerToContentHandoffResult,
} from "@/lib/marketing/content/types";

export type PrepareManagerToContentHandoffInput = CreateSelectedAgendaInput & {
  channel?: string;
  researchCandidate?: CompactManagerAgendaCandidate | null;
  researchBrief?: CompactManagerResearchBrief | null;
};

export function enrichSelectedAgendaInputFromResearch(
  input: PrepareManagerToContentHandoffInput,
): CreateSelectedAgendaInput {
  const candidate = input.researchCandidate;
  const brief = input.researchBrief;
  if (!candidate && !brief) return input;

  return {
    ...input,
    title: input.title || candidate?.title || brief?.title || "",
    summary: input.summary || candidate?.summary || brief?.summary || "",
    researchBriefId: input.researchBriefId ?? candidate?.researchBriefId ?? brief?.researchBriefId ?? null,
    agendaCandidateId: input.agendaCandidateId ?? candidate?.agendaCandidateId ?? null,
    destinations: input.destinations?.length ? input.destinations : brief?.destinations ?? candidate?.destinations ?? [],
    topics: input.topics?.length ? input.topics : brief?.topics ?? candidate?.topics ?? [],
    entities: input.entities?.length ? input.entities : brief?.entities ?? candidate?.entities ?? [],
    matchedProductIds:
      input.matchedProductIds?.length
        ? input.matchedProductIds
        : candidate?.matchedProductIds ?? brief?.commercialRelevance?.matchedProductIds ?? [],
    evidenceRefs:
      input.evidenceRefs?.length
        ? input.evidenceRefs
        : (brief?.evidence ?? candidate?.evidence ?? []).map((ref) =>
            mapManagerEvidenceRef(ref, candidate?.credibilityScore ?? brief?.credibilityScore),
          ),
    researchScoreAtSelection:
      input.researchScoreAtSelection ?? candidate?.totalResearchScore ?? null,
    managerDecisionSource: input.managerDecisionSource ?? "research_assisted",
    constraints: [
      ...(input.constraints ?? []),
      ...(candidate?.riskFlags ?? []).map((flag) => `risk:${flag}`),
      ...(brief?.risks ?? []).map((risk) => `risk:${risk}`),
    ],
  };
}

export function prepareManagerToContentHandoff(
  input: PrepareManagerToContentHandoffInput,
  deps: { store?: ContentAssignmentStore; now?: Date } = {},
): ManagerToContentHandoffResult {
  const store = deps.store ?? getDefaultContentAssignmentStore();
  const enriched = enrichSelectedAgendaInputFromResearch({ ...input, now: deps.now ?? input.now });
  const selectedAgenda = createSelectedAgenda(enriched);
  const idempotencyKey = enriched.idempotencyKey ?? selectedAgenda.id.replace(/^sa_/, "");

  const existing = store.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      selectedAgenda: existing.selectedAgenda,
      contentAssignment: existing.assignment,
      contentPlanScaffold: buildContentPlanScaffold(existing.assignment, existing.selectedAgenda),
    };
  }

  const contentAssignment = createContentAssignment({
    selectedAgenda,
    channel: input.channel,
    idempotencyKey,
    now: deps.now ?? input.now,
  });
  const contentPlanScaffold = buildContentPlanScaffold(contentAssignment, selectedAgenda);

  store.save({
    assignment: contentAssignment,
    selectedAgenda,
    idempotencyKey,
  });

  return { selectedAgenda, contentAssignment, contentPlanScaffold };
}
