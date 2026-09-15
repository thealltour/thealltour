/**
 * Human Story Selection — editorial boundary after ED-1 Point Gate, before RA-1.
 */

import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type {
  DurableStoryPointCandidateSet,
  StoryContentPoint,
  StoryPointGateResult,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { readStoryPointCandidateSetFromProductionRequest } from "@/lib/marketing/storyPoint/persistence";

export const PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION = "awaiting_story_selection" as const;
export const PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY = "humanStorySelection" as const;

export type HumanStorySelection = {
  /** Empty/null while awaiting (re)selection after research reject. */
  selectedStoryPointId: string | null;
  selectedStoryPointHash: string | null;
  selectedAt: string | null;
  selectedBy: "human";
  candidateSetInputRevision: string;
  /** Prior selections rejected by ED-2 (REFUTED / INSUFFICIENT). */
  researchRejectedStoryPointIds: string[];
  lastResearchRejectReason: string | null;
};

export function isAwaitingStorySelection(request: MarketingProductionRequest | null | undefined): boolean {
  return request?.metadata?.productionOutcome === PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION;
}

export function readHumanStorySelection(
  request: MarketingProductionRequest | null | undefined,
): HumanStorySelection | null {
  const raw = request?.metadata?.[PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.candidateSetInputRevision !== "string" || !o.candidateSetInputRevision.trim()) {
    return null;
  }
  if (o.selectedBy !== "human") return null;
  const id =
    typeof o.selectedStoryPointId === "string" && o.selectedStoryPointId.trim()
      ? o.selectedStoryPointId.trim()
      : null;
  const hash =
    typeof o.selectedStoryPointHash === "string" && o.selectedStoryPointHash.trim()
      ? o.selectedStoryPointHash.trim()
      : null;
  return {
    selectedStoryPointId: id,
    selectedStoryPointHash: hash,
    selectedAt: typeof o.selectedAt === "string" ? o.selectedAt : null,
    selectedBy: "human",
    candidateSetInputRevision: o.candidateSetInputRevision.trim(),
    researchRejectedStoryPointIds: Array.isArray(o.researchRejectedStoryPointIds)
      ? o.researchRejectedStoryPointIds.filter((x): x is string => typeof x === "string")
      : [],
    lastResearchRejectReason:
      typeof o.lastResearchRejectReason === "string" ? o.lastResearchRejectReason : null,
  };
}

export function listPassStoryCandidates(candidateSet: DurableStoryPointCandidateSet): Array<{
  point: StoryContentPoint;
  gate: StoryPointGateResult | null;
}> {
  const gateById = new Map(candidateSet.gateResults.map((g) => [g.pointId, g]));
  const passIds = new Set(
    candidateSet.gateResults.filter((g) => g.verdict === "pass").map((g) => g.pointId),
  );
  // Prefer selectedPointIds order when present; else gate pass order.
  const orderedIds =
    candidateSet.selectedPointIds.length > 0
      ? candidateSet.selectedPointIds.filter((id) => passIds.has(id))
      : [...passIds];
  const out: Array<{ point: StoryContentPoint; gate: StoryPointGateResult | null }> = [];
  for (const id of orderedIds) {
    const point = candidateSet.candidates.find((c) => c.pointId === id);
    if (!point) continue;
    out.push({ point, gate: gateById.get(id) ?? null });
  }
  return out;
}

/**
 * Apply human selection as authoritative primary; disable auto-primary from miner ranking.
 * Returns null if pointId is not a PASS candidate or revision mismatch.
 */
export function applyHumanSelectionToCandidateSet(input: {
  candidateSet: DurableStoryPointCandidateSet;
  selection: HumanStorySelection;
}): DurableStoryPointCandidateSet | null {
  if (!selectionIsActive(input.selection)) return null;
  if (input.selection.candidateSetInputRevision !== input.candidateSet.inputRevision) {
    return null;
  }
  const pass = listPassStoryCandidates(input.candidateSet);
  const hit = pass.find((p) => p.point.pointId === input.selection.selectedStoryPointId);
  if (!hit) return null;
  const hash = createStoryPointHash(hit.point);
  if (hash !== input.selection.selectedStoryPointHash) {
    return null;
  }
  const rejected = new Set(input.selection.researchRejectedStoryPointIds ?? []);
  if (rejected.has(hit.point.pointId)) {
    return null;
  }
  const alternates = pass
    .map((p) => p.point.pointId)
    .filter((id) => id !== hit.point.pointId && !rejected.has(id));
  return {
    ...input.candidateSet,
    primaryStoryPointId: hit.point.pointId,
    primaryStoryPointHash: hash,
    alternateStoryPointIds: [], // human choice — no auto-alternate
    selectedPointIds: [hit.point.pointId, ...alternates],
    diagnostics: {
      ...input.candidateSet.diagnostics,
      selectedPrimaryTitle:
        hit.point.storyQuestion ?? hit.point.storyClaim ?? hit.point.curiosityGap,
    },
  };
}

export function buildHumanStorySelection(input: {
  point: StoryContentPoint;
  candidateSet: DurableStoryPointCandidateSet;
  now?: Date;
  previous?: HumanStorySelection | null;
}): HumanStorySelection {
  return {
    selectedStoryPointId: input.point.pointId,
    selectedStoryPointHash: createStoryPointHash(input.point),
    selectedAt: (input.now ?? new Date()).toISOString(),
    selectedBy: "human",
    candidateSetInputRevision: input.candidateSet.inputRevision,
    researchRejectedStoryPointIds: input.previous?.researchRejectedStoryPointIds ?? [],
    lastResearchRejectReason: input.previous?.lastResearchRejectReason ?? null,
  };
}

export function markStoryResearchRejected(input: {
  selection: HumanStorySelection;
  reason: string;
}): HumanStorySelection {
  const rejected = new Set(input.selection.researchRejectedStoryPointIds ?? []);
  if (input.selection.selectedStoryPointId) {
    rejected.add(input.selection.selectedStoryPointId);
  }
  return {
    selectedStoryPointId: null,
    selectedStoryPointHash: null,
    selectedAt: null,
    selectedBy: "human",
    candidateSetInputRevision: input.selection.candidateSetInputRevision,
    researchRejectedStoryPointIds: [...rejected],
    lastResearchRejectReason: input.reason.slice(0, 240),
  };
}

export function selectionIsActive(selection: HumanStorySelection | null | undefined): boolean {
  return Boolean(selection?.selectedStoryPointId?.trim() && selection?.selectedStoryPointHash?.trim());
}

export function getPassCandidatesFromRequest(request: MarketingProductionRequest): Array<{
  point: StoryContentPoint;
  gate: StoryPointGateResult | null;
}> {
  const set = readStoryPointCandidateSetFromProductionRequest(request);
  if (!set || set.outcome !== "pass") return [];
  return listPassStoryCandidates(set);
}
