/**
 * Import external Editorial Director payload into production request Story candidate set.
 * Additive: never deletes internal Story Miner candidates.
 */

import { createHash, randomUUID } from "node:crypto";

import { deriveAgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";
import type { AgendaSlateCandidate, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  buildQueuedProductionRequest,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { createSelectedAgenda } from "@/lib/marketing/content/createSelectedAgenda";
import type { ContentAssignment, AssignmentEvidenceRef } from "@/lib/marketing/content/types";
import { CONTENT_ASSIGNMENT_CONTRACT } from "@/lib/marketing/content/types";
import {
  EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
  EXTERNAL_STORY_PROVIDER_CHATGPT_MANUAL,
  EXTERNAL_STORY_SOURCE,
  PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY,
  PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY,
  type ExternalEditorialDirectorPayload,
  type ExternalEditorialImportRecord,
  type ExternalStoryProvenance,
} from "@/lib/marketing/editorialDirector/contracts";
import { normalizeAndGateExternalStories } from "@/lib/marketing/editorialDirector/normalizeExternalStory";
import {
  PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
  PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
} from "@/lib/marketing/storyPoint/humanStorySelection";
import {
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  type DurableStoryPointCandidateSet,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash, createStoryPointInputRevision } from "@/lib/marketing/storyPoint/hash";
import { parseDurableStoryPointCandidateSet } from "@/lib/marketing/storyPoint/persistence";

function mapEvidenceRefs(item: AgendaSlateCandidate): AssignmentEvidenceRef[] {
  const nowIso = new Date().toISOString();
  return item.evidenceSummary.map((e) => ({
    evidenceId: e.evidenceId,
    sourceId: e.sourceId,
    sourceType: e.sourceType,
    sourceName: e.sourceName,
    isOfficial: e.isOfficial,
    evidenceType: "snippet",
    url: e.url,
    reference: null,
    excerpt: e.excerpt,
    publishedAt: null,
    observedAt: nowIso,
    credibilityHint: null,
  }));
}

function slateAgendaFromCandidate(item: AgendaSlateCandidate) {
  return createSelectedAgenda({
    title: item.title,
    summary: item.summary,
    rationale: item.rationale,
    destinations: item.destinations,
    topics: item.topics,
    entities: item.entities,
    audienceHint: item.audienceHint,
    matchedProductIds: item.matchedProductIds,
    agendaCandidateId: item.agendaCandidateId,
    researchBriefId: item.researchBriefId,
    researchScoreAtSelection: item.score,
    evidenceRefs: mapEvidenceRefs(item),
  });
}

function stubAssignment(item: AgendaSlateCandidate, selectedAgendaId: string): ContentAssignment {
  const nowIso = new Date().toISOString();
  const evidenceRefs = mapEvidenceRefs(item);
  return {
    contract: CONTENT_ASSIGNMENT_CONTRACT,
    assignmentId: `asg_ext_${createHash("sha256").update(item.slateItemId).digest("hex").slice(0, 16)}`,
    createdAt: nowIso,
    selectedAgendaId,
    selectedAgendaTitle: item.title,
    objective: item.summary || item.title,
    topic: item.topics[0] ?? item.title,
    audience: item.audienceHint,
    destinations: item.destinations,
    facts: evidenceRefs
      .map((e) => e.excerpt)
      .filter((x): x is string => Boolean(x))
      .slice(0, 6)
      .map((statement, i) => ({
        factId: `f_ext_${i}`,
        statement,
        confidence: "medium" as const,
        evidenceRefs: [],
      })),
    commercialIntent: "informational",
    matchedProductIds: item.matchedProductIds,
    constraints: [],
    formatHints: [],
    requiredOutputs: ["content_plan", "text_draft"],
    deadline: null,
    evidenceRefs,
    riskNotes: item.riskFlags,
    provenance: {
      selectedAgendaId,
      createdBy: "marketing-manager-handoff",
      idempotencyKey: `ext_import_${item.slateItemId}`,
    },
  };
}

function emptyCandidateSet(input: {
  agendaId: string;
  assignmentId: string;
  inputRevision: string;
  nowIso: string;
}): DurableStoryPointCandidateSet {
  return {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
    agendaId: input.agendaId,
    assignmentId: input.assignmentId,
    inputRevision: input.inputRevision,
    logicalIdentity: `${input.agendaId}:${input.assignmentId}:${input.inputRevision}`,
    createdAt: input.nowIso,
    attempts: 0,
    llmCallCount: 0,
    outcome: "pass",
    skipReason: null,
    candidates: [],
    gateResults: [],
    selectedPointIds: [],
    primaryStoryPointId: null,
    alternateStoryPointIds: [],
    primaryStoryPointHash: null,
    diagnostics: {
      candidateCount: 0,
      passCount: 0,
      diversityRejectedCount: 0,
      identityRejectedCount: 0,
      mechanisms: [],
      selectedPrimaryTitle: null,
      attemptSummaries: [],
    },
  };
}

function mergeCandidateSet(
  base: DurableStoryPointCandidateSet,
  additions: ReturnType<typeof normalizeAndGateExternalStories>,
): {
  next: DurableStoryPointCandidateSet;
  addedPointIds: string[];
  skippedDuplicatePointIds: string[];
  rejected: Array<{ externalStoryId: string; reasons: string[] }>;
} {
  const byId = new Map(base.candidates.map((c) => [c.pointId, c]));
  const gates = new Map(base.gateResults.map((g) => [g.pointId, g]));
  const addedPointIds: string[] = [];
  const skippedDuplicatePointIds: string[] = [];
  const rejected: Array<{ externalStoryId: string; reasons: string[] }> = [];

  for (const row of additions) {
    if (!row.accepted) {
      rejected.push({ externalStoryId: row.externalStoryId, reasons: row.rejectReasons });
      continue;
    }
    if (byId.has(row.point.pointId)) {
      skippedDuplicatePointIds.push(row.point.pointId);
      continue;
    }
    byId.set(row.point.pointId, row.point);
    gates.set(row.point.pointId, row.gate);
    addedPointIds.push(row.point.pointId);
  }

  const candidates = [...byId.values()];
  const gateResults = [...gates.values()];
  const passIds = gateResults.filter((g) => g.verdict === "pass").map((g) => g.pointId);
  const selectedPointIds = [...new Set([...base.selectedPointIds, ...passIds])].filter((id) =>
    passIds.includes(id),
  );

  const primaryStoryPointId =
    base.primaryStoryPointId && passIds.includes(base.primaryStoryPointId)
      ? base.primaryStoryPointId
      : selectedPointIds[0] ?? null;
  const primary = primaryStoryPointId
    ? candidates.find((c) => c.pointId === primaryStoryPointId) ?? null
    : null;

  return {
    next: {
      ...base,
      outcome: passIds.length > 0 ? "pass" : "skip",
      skipReason: passIds.length > 0 ? null : "story_point_generation_failed",
      candidates,
      gateResults,
      selectedPointIds,
      primaryStoryPointId,
      alternateStoryPointIds: selectedPointIds.filter((id) => id !== primaryStoryPointId).slice(0, 2),
      primaryStoryPointHash: primary ? createStoryPointHash(primary) : null,
      diagnostics: {
        ...base.diagnostics,
        candidateCount: candidates.length,
        passCount: passIds.length,
        identityRejectedCount:
          base.diagnostics.identityRejectedCount +
          rejected.filter((r) => r.reasons.some((x) => x.startsWith("identity:"))).length,
        mechanisms: [...new Set(candidates.flatMap((c) => c.mechanisms))],
        selectedPrimaryTitle:
          primary?.storyQuestion ?? primary?.storyClaim ?? base.diagnostics.selectedPrimaryTitle,
      },
    },
    addedPointIds,
    skippedDuplicatePointIds,
    rejected,
  };
}

export type ImportExternalEditorialResult = {
  request: MarketingProductionRequest;
  importRecord: ExternalEditorialImportRecord;
  createdRequest: boolean;
  preview: {
    agendaId: string;
    agendaTitle: string;
    storyCountAccepted: number;
    storyTitles: string[];
    rejectedCount: number;
  };
};

export async function importExternalEditorialDirector(input: {
  slate: DailyAgendaSlate;
  payload: ExternalEditorialDirectorPayload;
  productionRequestRepo: MarketingProductionRequestRepository;
  provider?: string;
  now?: Date;
  productId?: string | null;
}): Promise<ImportExternalEditorialResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const provider = input.provider ?? EXTERNAL_STORY_PROVIDER_CHATGPT_MANUAL;
  const agendaId = input.payload.selectedAgenda.agendaId?.trim();
  if (!agendaId) {
    throw Object.assign(new Error("selectedAgenda.agendaId required"), {
      code: "MISSING_SELECTED_AGENDA",
      status: 400,
    });
  }

  const slateItem =
    input.slate.candidates.find((c) => c.slateItemId === agendaId) ??
    input.slate.candidates.find((c) => c.agendaCandidateId === agendaId);
  if (!slateItem) {
    throw Object.assign(new Error(`agendaId not in current slate: ${agendaId}`), {
      code: "UNKNOWN_AGENDA",
      status: 400,
    });
  }

  const selectedAgenda = slateAgendaFromCandidate(slateItem);
  const assignment = stubAssignment(slateItem, selectedAgenda.id);
  const identity = deriveAgendaTopicIdentity({
    selectedAgenda,
    assignment,
  });

  const normalized = normalizeAndGateExternalStories({
    stories: input.payload.storyCandidates,
    agendaId: slateItem.slateItemId,
    identity,
  });

  let existing = await input.productionRequestRepo.findByLogicalKey(
    buildQueuedProductionRequest({
      slate: input.slate,
      candidate: slateItem,
      now,
      productId: input.productId,
    }).logicalRunKey,
  );

  // Prefer lookup by slate item among today's requests when logical key race.
  if (!existing) {
    const dayRows = await input.productionRequestRepo.listByBusinessDate(input.slate.businessDateKst);
    existing = dayRows.find((r) => r.slateItemId === slateItem.slateItemId) ?? null;
  }

  if (existing?.completedCandidateId) {
    throw Object.assign(new Error("production already completed with candidate"), {
      code: "PRODUCTION_ALREADY_COMPLETE",
      status: 409,
    });
  }
  if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) {
    throw Object.assign(
      new Error(`cannot import while status is ${existing.status}; wait for Story 선택 대기`),
      { code: "PRODUCTION_BUSY", status: 409 },
    );
  }

  let createdRequest = false;
  if (!existing) {
    const queued = buildQueuedProductionRequest({
      slate: input.slate,
      candidate: slateItem,
      now,
      productId: input.productId,
    });
    const enqueued = await input.productionRequestRepo.enqueue(queued);
    existing = enqueued.request;
    createdRequest = enqueued.created;
  }

  const inputRevision = createStoryPointInputRevision({
    agendaId: selectedAgenda.id,
    assignmentId: assignment.assignmentId,
    agendaTitle: slateItem.title,
    agendaSummary: slateItem.summary,
    assignmentObjective: assignment.objective,
    commercialIntent: String(assignment.commercialIntent ?? ""),
    evidenceSnippet: slateItem.evidenceSummary
      .map((e) => e.excerpt)
      .filter(Boolean)
      .join(" | ")
      .slice(0, 400),
  });

  const priorSet =
    parseDurableStoryPointCandidateSet(
      existing.metadata?.[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY],
    ) ??
    emptyCandidateSet({
      agendaId: selectedAgenda.id,
      assignmentId: assignment.assignmentId,
      inputRevision,
      nowIso,
    });

  // Keep existing inputRevision when merging into an ED-1 set so human selection
  // invalidation stays tied to agenda identity, not import churn.
  const baseSet: DurableStoryPointCandidateSet = {
    ...priorSet,
    inputRevision: priorSet.candidates.length > 0 ? priorSet.inputRevision : inputRevision,
    logicalIdentity:
      priorSet.candidates.length > 0
        ? priorSet.logicalIdentity
        : `${selectedAgenda.id}:${assignment.assignmentId}:${inputRevision}`,
  };

  const merged = mergeCandidateSet(baseSet, normalized);
  if (merged.addedPointIds.length === 0 && merged.skippedDuplicatePointIds.length === 0) {
    throw Object.assign(
      new Error(
        merged.rejected.length
          ? `모든 Story가 검증에 실패했습니다: ${merged.rejected
              .map((r) => `${r.externalStoryId}(${r.reasons.join(",")})`)
              .join("; ")}`
          : "가져올 Story가 없습니다",
      ),
      { code: "ALL_STORIES_REJECTED", status: 400 },
    );
  }
  if (merged.next.outcome !== "pass") {
    throw Object.assign(new Error("PASS Story가 없어 가져올 수 없습니다"), {
      code: "NO_PASS_STORIES",
      status: 400,
    });
  }

  const importId = `imp_${createHash("sha256")
    .update(`${existing.logicalRunKey}|${nowIso}|${randomUUID()}`, "utf8")
    .digest("hex")
    .slice(0, 16)}`;

  const provenanceMap: Record<string, ExternalStoryProvenance> = {
    ...((existing.metadata?.[PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY] as
      | Record<string, ExternalStoryProvenance>
      | undefined) ?? {}),
  };
  for (const row of normalized) {
    if (!merged.addedPointIds.includes(row.point.pointId)) continue;
    const ext = input.payload.storyCandidates.find((s) => s.externalStoryId === row.externalStoryId);
    provenanceMap[row.point.pointId] = {
      source: EXTERNAL_STORY_SOURCE,
      provider,
      importedAt: nowIso,
      agendaId: slateItem.slateItemId,
      importContractVersion: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
      externalStoryId: row.externalStoryId,
      editorialArchetype: ext?.editorialArchetype ?? null,
      storyTitleKo: ext?.storyTitleKo ?? null,
      importId,
    };
  }

  const importRecord: ExternalEditorialImportRecord = {
    importId,
    importedAt: nowIso,
    provider,
    agendaId: slateItem.slateItemId,
    importContractVersion: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
    addedPointIds: merged.addedPointIds,
    skippedDuplicatePointIds: merged.skippedDuplicatePointIds,
    rejected: merged.rejected,
    selectedAgendaReasonKo: input.payload.selectedAgenda.reasonKo,
    agendaEvaluation: input.payload.agendaEvaluation,
  };

  const priorImports = Array.isArray(
    existing.metadata?.[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY],
  )
    ? (existing.metadata[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] as unknown[])
    : [];

  const updated: MarketingProductionRequest = {
    ...existing,
    status: "COMPLETED",
    completedAt: nowIso,
    failedAt: null,
    lastError: null,
    errorMessage: null,
    completedCandidateId: null,
    claimedAt: null,
    startedAt: null,
    claimToken: null,
    workerId: null,
    updatedAt: nowIso,
    metadata: {
      ...existing.metadata,
      productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
      [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: merged.next,
      [PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY]: nowIso,
      [PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY]: provenanceMap,
      [PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY]: [...priorImports, importRecord].slice(-12),
      // Do not auto-select; clear stale human selection only when revision unchanged
      // and no active selection — keep previous selection if still valid for revision.
      ...(existing.metadata?.[PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]
        ? {}
        : { [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: null }),
    },
  };

  const request = await input.productionRequestRepo.update(updated);

  const acceptedPoints = merged.next.candidates.filter((c) =>
    merged.addedPointIds.includes(c.pointId),
  );

  return {
    request,
    importRecord,
    createdRequest,
    preview: {
      agendaId: slateItem.slateItemId,
      agendaTitle: slateItem.title,
      storyCountAccepted: merged.addedPointIds.length,
      storyTitles: acceptedPoints.map(
        (p) => p.storyQuestion ?? p.storyClaim ?? p.curiosityGap,
      ),
      rejectedCount: merged.rejected.length,
    },
  };
}
