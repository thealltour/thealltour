/**
 * Optional additive hook: after V1 slate build, run V2 shadow when enabled.
 * Default OFF — returns null and does not touch production slate.
 */

import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import { isAgendaQualityV2ShadowEnabled } from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  runAgendaQualityV2Shadow,
  type RunAgendaQualityV2ShadowResult,
} from "@/lib/marketing/agendaQualityV2/shadow/runShadow";
import type { AgendaTransformInvoke } from "@/lib/marketing/agendaQualityV2/transformer/transform";

export type MaybeRunAgendaQualityV2ShadowAfterV1Params = {
  agendaCandidates: AgendaCandidate[];
  /** Required only when shadow is enabled and fixtures are not used. */
  invoke?: AgendaTransformInvoke;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  nowIso?: string;
};

/**
 * Parallel dry-run entrypoint. Never mutates or returns a replacement slate.
 */
export async function maybeRunAgendaQualityV2ShadowAfterV1(
  params: MaybeRunAgendaQualityV2ShadowAfterV1Params,
): Promise<RunAgendaQualityV2ShadowResult> {
  if (!isAgendaQualityV2ShadowEnabled(params.env ?? process.env)) {
    return { enabled: false, productionSlateUnchanged: true, report: null };
  }

  const sources = params.agendaCandidates.map((c) => ({
    originalTitle: c.title,
    originalSummary: c.rationale,
    sourceType: "agenda_candidate_v1",
    input: {
      originalTitle: c.title,
      originalSummary: c.rationale,
      sourceTypes: ["agenda_candidate"],
      sourceCandidateIds: [c.id],
      sourceBriefIds: c.researchBriefId ? [c.researchBriefId] : [],
      sourceCredibility: c.credibilityScore,
      sourceFreshness: c.freshnessScore,
      koreanTravelerRelevance: c.koreanOutboundRelevanceScore ?? c.travelRelevanceScore,
      sourceFingerprint: `v1cand:${c.id}`,
    },
  }));

  return runAgendaQualityV2Shadow({
    sources,
    invoke: params.invoke,
    env: params.env,
    nowIso: params.nowIso,
  });
}
