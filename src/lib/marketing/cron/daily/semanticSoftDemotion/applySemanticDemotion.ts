import type {
  CompactManagerAgendaCandidate,
  MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";
import type { SemanticSoftDemotionReport } from "@/lib/marketing/cron/daily/semanticSoftDemotion/types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Apply soft demotion to pool rank scores. Never removes candidates.
 * Separated from compute for shadow validation.
 */
export function applySemanticDemotion(
  context: MarketingResearchContext,
  report: SemanticSoftDemotionReport,
): {
  context: MarketingResearchContext;
  orderBefore: string[];
  orderAfter: string[];
  moved: Array<{ agendaCandidateId: string; from: number; to: number; demotionAmount: number }>;
} {
  const orderBefore = context.agendaCandidates.map((c) => c.agendaCandidateId);
  const originalIndex = new Map(orderBefore.map((id, i) => [id, i]));
  const byId = new Map(report.decisions.map((d) => [d.agendaCandidateId, d]));

  const adjusted: CompactManagerAgendaCandidate[] = context.agendaCandidates.map((candidate) => {
    const decision = byId.get(candidate.agendaCandidateId);
    if (!decision || decision.demotionAmount <= 0) return candidate;

    const nextScore = clamp01(candidate.totalResearchScore * (1 - decision.demotionAmount));
    const reasons = [...(candidate.scoreReasons ?? [])];
    reasons.push(`semantic_soft_demoted_${decision.demotionAmount.toFixed(2)}`);
    if (decision.demotionReason) reasons.push(decision.demotionReason);
    if (decision.semanticSimilarity != null) {
      reasons.push(`semantic_sim_${decision.semanticSimilarity.toFixed(2)}`);
    }
    const riskFlags = [...(candidate.riskFlags ?? [])];
    if (!riskFlags.includes("semantic_near_duplicate")) {
      riskFlags.push("semantic_near_duplicate");
    }

    return {
      ...candidate,
      totalResearchScore: nextScore,
      scoreReasons: reasons,
      riskFlags,
    };
  });

  // Stable re-rank: preserve original relative order when scores tie / unchanged.
  adjusted.sort(
    (a, b) =>
      b.totalResearchScore - a.totalResearchScore ||
      (originalIndex.get(a.agendaCandidateId) ?? 0) - (originalIndex.get(b.agendaCandidateId) ?? 0),
  );

  const orderAfter = adjusted.map((c) => c.agendaCandidateId);
  const moved: Array<{
    agendaCandidateId: string;
    from: number;
    to: number;
    demotionAmount: number;
  }> = [];
  for (let i = 0; i < orderAfter.length; i += 1) {
    const id = orderAfter[i]!;
    const from = orderBefore.indexOf(id);
    if (from !== i) {
      moved.push({
        agendaCandidateId: id,
        from,
        to: i,
        demotionAmount: byId.get(id)?.demotionAmount ?? 0,
      });
    }
  }

  const notes = [...(context.notes ?? [])];
  if (report.degraded) {
    notes.push(`semantic_soft_demotion_degraded:${report.degradeReason ?? "unknown"}`);
  } else if (!report.semanticAvailable) {
    notes.push("semantic_soft_demotion_unavailable");
  } else {
    notes.push(
      `semantic_soft_demotion_applied:${report.demotedCount}:${report.embeddingsLoaded}`,
    );
  }

  return {
    context: {
      ...context,
      agendaCandidates: adjusted,
      notes,
      observability: {
        ...context.observability,
        candidateCount: adjusted.length,
        topScore: adjusted[0]?.totalResearchScore ?? context.observability.topScore,
      },
      degradedState:
        report.degraded
          ? {
              semanticInfrastructureAvailable: false,
              reason: report.degradeReason ?? "semantic_repository_error",
            }
          : context.degradedState,
    },
    orderBefore,
    orderAfter,
    moved,
  };
}
