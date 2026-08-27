import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { AiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import { buildModelQuotaState } from "@/ai-runtime/quota/quota-state";
import type { UsageLedgerAggregation } from "@/ai-runtime/quota/usage-ledger";
import { policyRankForModel, scoreCandidate, sortCandidates } from "@/ai-runtime/router/scoring";
import type { RoutingCandidate } from "@/ai-runtime/router/types";

export function buildEligibilityCriteria(request: RuntimeRequest) {
  const hints = request.routing;
  return {
    workload: request.workload,
    requiresStructuredOutput: hints?.requiresStructuredOutput,
    requiresToolCalling: hints?.requiresToolCalling,
    excludeProviderIds: hints?.excludedProviderIds,
    excludeModelIds: hints?.excludedModelIds,
  };
}

export function buildRoutingCandidates(input: {
  request: RuntimeRequest;
  registry: AiRuntimeRegistry;
  ledger: UsageLedgerAggregation;
  now?: () => Date;
}): RoutingCandidate[] {
  const criteria = buildEligibilityCriteria(input.request);
  const eligible = input.registry.findEligibleModels(criteria);

  const now = input.now ?? (() => new Date());
  const candidates: RoutingCandidate[] = [];

  for (const model of eligible) {
    const quotaState = buildModelQuotaState(model.providerId, model.id, {
      ledger: input.ledger,
      now,
    });

    if (quotaState.health === "blocked") {
      continue;
    }

    const candidate: RoutingCandidate = {
      model,
      quotaHealth: quotaState.health,
      capabilityScore: scoreCandidate({
        model,
        workload: input.request.workload,
        priority: input.request.priority,
        quotaHealth: quotaState.health,
        request: input.request,
      }),
      policyRank: policyRankForModel(model.id, input.request.workload),
      score: 0,
    };

    candidate.score = scoreCandidate({
      model,
      workload: input.request.workload,
      priority: input.request.priority,
      quotaHealth: quotaState.health,
      request: input.request,
    });

    candidates.push(candidate);
  }

  return sortCandidates(candidates);
}

export function uniqueCandidatesByModel(candidates: RoutingCandidate[]): RoutingCandidate[] {
  const seen = new Set<string>();
  const result: RoutingCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.model.id)) continue;
    seen.add(candidate.model.id);
    result.push(candidate);
  }
  return result;
}
