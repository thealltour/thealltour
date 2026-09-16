import type { AgendaReservoirItem } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { markReservoirSuperseded } from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { detectMaterialUpdate } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";

export type SupersedeEvidence = {
  shouldSupersede: boolean;
  reason: string;
  oldAgendaId: string;
  newAgendaId: string;
};

/**
 * Foundation helper — does not auto-apply unless caller opts in.
 * Same topic + material update + newer candidate → SUPERSEDED evidence.
 */
export function evaluateSupersedeEvidence(params: {
  older: AgendaReservoirItem;
  newer: AgendaReservoirItem;
}): SupersedeEvidence {
  const sameTopic =
    params.older.topicFingerprint &&
    params.older.topicFingerprint === params.newer.topicFingerprint;
  if (!sameTopic) {
    return {
      shouldSupersede: false,
      reason: "different_topic",
      oldAgendaId: params.older.agendaId,
      newAgendaId: params.newer.agendaId,
    };
  }
  const material = detectMaterialUpdate({
    previousSummary: params.older.candidate.signalContext.signalSummaryKo,
    newSummary: params.newer.candidate.signalContext.signalSummaryKo,
    previousWhyNow: params.older.candidate.editorial.whyNowKo,
    newWhyNow: params.newer.candidate.editorial.whyNowKo,
  });
  if (!material) {
    return {
      shouldSupersede: false,
      reason: "no_material_update",
      oldAgendaId: params.older.agendaId,
      newAgendaId: params.newer.agendaId,
    };
  }
  return {
    shouldSupersede: true,
    reason: "same_topic_material_update",
    oldAgendaId: params.older.agendaId,
    newAgendaId: params.newer.agendaId,
  };
}

export function applySupersedeIfEvidence(
  older: AgendaReservoirItem,
  evidence: SupersedeEvidence,
  nowIso?: string,
): AgendaReservoirItem | null {
  if (!evidence.shouldSupersede) return null;
  if (older.status === "SUPERSEDED" || older.status === "EXPIRED" || older.status === "REJECTED") {
    return null;
  }
  try {
    return markReservoirSuperseded(older, evidence.newAgendaId, nowIso);
  } catch {
    return null;
  }
}
