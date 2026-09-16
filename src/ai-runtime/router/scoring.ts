import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { QuotaHealth } from "@/ai-runtime/domain/quota";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import {
  QUALITY_SENSITIVE_WORKLOADS,
  ROUTING_SCORE_WEIGHTS,
  WORKLOAD_CAPABILITY_AXIS,
  WORKLOAD_MODEL_ORDER,
} from "@/ai-runtime/router/policies";
import {
  mapAgentIdToRoleKey,
  resolveModelRoute,
  type ResolvedModelRoute,
} from "@/ai-runtime/router/role-routes";
import type { RoutingCandidate } from "@/ai-runtime/router/types";

function isProviderManaged(model: ModelDefinition): boolean {
  return model.metadata?.routingMode === "provider-managed";
}

function isFreeTier(model: ModelDefinition): boolean {
  return model.economics.freeTierEligible === true || isProviderManaged(model);
}

export function capabilityScoreForWorkload(
  model: ModelDefinition,
  workload: WorkloadClass,
): number {
  const axis = WORKLOAD_CAPABILITY_AXIS[workload];
  const value = model.capabilities[axis];
  return typeof value === "number" ? value : 0;
}

export function quotaHealthScore(health: QuotaHealth): number {
  return ROUTING_SCORE_WEIGHTS.quotaHealth[health];
}

export function resolveRequestModelRoute(request: RuntimeRequest): ResolvedModelRoute {
  const explicit =
    typeof request.metadata?.roleKey === "string" ? request.metadata.roleKey.trim() : "";
  const fromAgent = mapAgentIdToRoleKey(request.agentId, request.workload);
  return resolveModelRoute({
    role: explicit || fromAgent,
    workload: request.workload,
  });
}

export function policyRankForModel(
  modelId: string,
  workload: WorkloadClass,
  modelOrder?: readonly string[],
): number {
  const order = modelOrder ?? WORKLOAD_MODEL_ORDER[workload];
  const index = order.indexOf(modelId);
  return index >= 0 ? order.length - index : 0;
}

export function scoreCandidate(input: {
  model: ModelDefinition;
  workload: WorkloadClass;
  priority: RuntimePriority;
  quotaHealth: QuotaHealth;
  request: RuntimeRequest;
  modelOrder?: readonly string[];
}): number {
  const { model, workload, priority, quotaHealth, request } = input;
  const modelOrder = input.modelOrder ?? WORKLOAD_MODEL_ORDER[workload];

  if (quotaHealth === "blocked") {
    return ROUTING_SCORE_WEIGHTS.quotaHealth.blocked;
  }

  let score = model.routing.basePriority;
  score += capabilityScoreForWorkload(model, workload) * ROUTING_SCORE_WEIGHTS.capabilityMultiplier;
  score += quotaHealthScore(quotaHealth);
  score += policyRankForModel(model.id, workload, modelOrder) * ROUTING_SCORE_WEIGHTS.policyRankBonus;

  if (isFreeTier(model)) {
    score += ROUTING_SCORE_WEIGHTS.freeTierBonus[priority];
  }

  if (
    isProviderManaged(model) &&
    QUALITY_SENSITIVE_WORKLOADS.has(workload) &&
    priority !== "background"
  ) {
    score -= ROUTING_SCORE_WEIGHTS.qualitySensitiveProviderManagedPenalty;
  }

  if (model.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY) {
    const preferredModelIds = request.routing?.preferredModelIds ?? [];
    const topOfRoute = modelOrder[0] === model.id;
    if (!preferredModelIds.includes(model.id) && !topOfRoute) {
      score -= ROUTING_SCORE_WEIGHTS.secondaryGeminiPenalty;
    }
  }

  const preferredProviders = request.routing?.preferredProviderIds ?? [];
  if (preferredProviders.includes(model.providerId)) {
    score += ROUTING_SCORE_WEIGHTS.preferredProviderBonus;
  }

  const preferredModels = request.routing?.preferredModelIds ?? [];
  if (preferredModels.includes(model.id)) {
    score += ROUTING_SCORE_WEIGHTS.preferredModelBonus;
  }

  return score;
}

export function compareCandidates(a: RoutingCandidate, b: RoutingCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.policyRank !== a.policyRank) return b.policyRank - a.policyRank;
  return a.model.id.localeCompare(b.model.id);
}

export function sortCandidates(candidates: RoutingCandidate[]): RoutingCandidate[] {
  return [...candidates].sort(compareCandidates);
}
