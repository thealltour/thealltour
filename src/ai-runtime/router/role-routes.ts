/**
 * ORG_ROUTING_ALIGNMENT_V1 — role-aware model route overrides.
 * Workload defaults remain the fail-safe base. Unknown/missing roles never block routing.
 */

import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import {
  MODEL_DISPLAY_LABELS,
  WORKLOAD_MODEL_ORDER,
} from "@/ai-runtime/router/policies";

export const MARKETING_ROLE_ROUTE_KEYS = [
  "marketing_manager",
  "story_point_miner",
  "research_synthesis",
  "content_strategist",
  "governance_auditor",
  "asset_source_writer",
  "channel_editor",
  "performance_analysis_basic",
  "performance_analysis_reasoning",
  /** AGENDA_QUALITY_V2 — signal→decision agenda seed (not Content Strategist). */
  "marketing_agenda_transformer",
] as const;

export type MarketingRoleRouteKey = (typeof MARKETING_ROLE_ROUTE_KEYS)[number];

export type ModelRouteSource = "role_override" | "workload_default";

export type ResolvedModelRoute = {
  modelIds: readonly string[];
  routeSource: ModelRouteSource;
  roleKey: MarketingRoleRouteKey | null;
  workload: WorkloadClass;
};

/**
 * Declarative role overrides. Manual ChatGPT/Astra roles intentionally omitted —
 * they are not automatic provider routes.
 */
export const ROLE_MODEL_ROUTES: Record<MarketingRoleRouteKey, readonly string[]> = {
  marketing_manager: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  story_point_miner: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  research_synthesis: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  content_strategist: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
  ],
  governance_auditor: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  asset_source_writer: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  channel_editor: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  performance_analysis_basic: [
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  performance_analysis_reasoning: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
  /** Gemini → OpenRouter → NVIDIA → Gemini Secondary */
  marketing_agenda_transformer: [
    AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    AI_MODEL_IDS.OPENROUTER_FREE,
    AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
    AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
  ],
};

export const ROLE_ROUTE_DISPLAY_LABELS: Record<MarketingRoleRouteKey, string> = {
  marketing_manager: "Marketing Manager",
  story_point_miner: "Story/Point Miner",
  research_synthesis: "Research Synthesis",
  content_strategist: "Content Strategist",
  governance_auditor: "Governance Auditor",
  asset_source_writer: "Asset Source Writer",
  channel_editor: "Channel Editors",
  performance_analysis_basic: "Performance Analysis Basic",
  performance_analysis_reasoning: "Performance Analysis Reasoning",
  marketing_agenda_transformer: "Marketing Agenda Transformer",
};

const ROLE_KEY_SET = new Set<string>(MARKETING_ROLE_ROUTE_KEYS);

export function isMarketingRoleRouteKey(value: unknown): value is MarketingRoleRouteKey {
  return typeof value === "string" && ROLE_KEY_SET.has(value);
}

/** Map known runtime agentId → role route key. Unknown agents return null (workload fallback). */
export function mapAgentIdToRoleKey(
  agentId: string | null | undefined,
  workload?: WorkloadClass,
): MarketingRoleRouteKey | null {
  const id = (agentId ?? "").trim().toLowerCase();
  if (!id) return null;
  switch (id) {
    case "marketing-manager":
      // Only apply when this agent is doing manager work — avoid hijacking other workloads.
      return workload === "manager_decision" ? "marketing_manager" : null;
    case "governance-auditor":
      return workload === "governance" ? "governance_auditor" : null;
    case "performance-analyst":
      if (workload === "reasoning") return "performance_analysis_reasoning";
      if (workload === "analysis" || workload === "summarization") {
        return "performance_analysis_basic";
      }
      return null;
    case "story-point-miner":
    case "story_point_miner":
      return "story_point_miner";
    case "asset-source-writer":
    case "asset_source_writer":
      return "asset_source_writer";
    case "channel-editor":
    case "channel_editor":
    case "channel-producer":
      return "channel_editor";
    case "research-synthesis":
    case "research_synthesis":
      return "research_synthesis";
    case "content-strategist":
    case "content_strategist":
      // Shared Hermes/Runtime transport for Story Miner / ACRB / Asset Writer / Channels.
      // Require explicit metadata.roleKey — do not infer from agentId alone.
      return null;
    default:
      return null;
  }
}

function isValidModelOrder(order: unknown): order is readonly string[] {
  return (
    Array.isArray(order) &&
    order.length > 0 &&
    order.every((id) => typeof id === "string" && id.trim().length > 0)
  );
}

/**
 * Resolve model preference order.
 * Role override wins when recognized + valid; otherwise workload default.
 * Never throws for unknown/missing role.
 */
export function resolveModelRoute(input: {
  role?: string | null;
  workload: WorkloadClass;
}): ResolvedModelRoute {
  const workload = input.workload;
  const workloadOrder = WORKLOAD_MODEL_ORDER[workload];
  const roleRaw = typeof input.role === "string" ? input.role.trim() : "";

  if (!roleRaw || !isMarketingRoleRouteKey(roleRaw)) {
    return {
      modelIds: workloadOrder,
      routeSource: "workload_default",
      roleKey: null,
      workload,
    };
  }

  const override = ROLE_MODEL_ROUTES[roleRaw];
  if (!isValidModelOrder(override)) {
    return {
      modelIds: workloadOrder,
      routeSource: "workload_default",
      roleKey: null,
      workload,
    };
  }

  return {
    modelIds: override,
    routeSource: "role_override",
    roleKey: roleRaw,
    workload,
  };
}

export function formatRolePolicyOrder(role: MarketingRoleRouteKey): string[] {
  return ROLE_MODEL_ROUTES[role].map((modelId) => MODEL_DISPLAY_LABELS[modelId] ?? modelId);
}

export function listRoleRoutingPolicies(): Array<{
  roleKey: MarketingRoleRouteKey;
  label: string;
  orderLabels: string[];
}> {
  return MARKETING_ROLE_ROUTE_KEYS.map((roleKey) => ({
    roleKey,
    label: ROLE_ROUTE_DISPLAY_LABELS[roleKey],
    orderLabels: formatRolePolicyOrder(roleKey),
  }));
}
