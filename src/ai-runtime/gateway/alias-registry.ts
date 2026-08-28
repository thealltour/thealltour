import type { AgentId } from "@/ai-runtime/domain/agent";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
  RUNTIME_SPIKE_AGENT_ID,
} from "@/ai-runtime/integration/constants";

export const HERMES_INFERENCE_ALIAS_MARKETING_MANAGER = "thealltour/marketing-manager";
export const HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST = "thealltour/content-strategist";
export const HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR = "thealltour/governance-auditor";
export const HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST = "thealltour/performance-analyst";

export type GatewayAliasKind = "production" | "spike";

export type GatewayAliasEntry = {
  /** Canonical lowercase alias string sent as OpenAI `model`. */
  alias: string;
  kind: GatewayAliasKind;
  agentId: AgentId;
  workload: WorkloadClass;
  priority: RuntimePriority;
  /** When true, C4.1 controlled first-candidate failure may be enabled for this alias. */
  allowsSpikeForceFallback: boolean;
};

const REGISTRY: GatewayAliasEntry[] = [
  {
    alias: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
    kind: "production",
    agentId: "performance-analyst",
    workload: "analysis",
    priority: "normal",
    allowsSpikeForceFallback: false,
  },
  {
    alias: HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
    kind: "production",
    agentId: "content-strategist",
    workload: "content_draft",
    priority: "normal",
    allowsSpikeForceFallback: false,
  },
  {
    alias: HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
    kind: "production",
    agentId: "governance-auditor",
    workload: "governance",
    priority: "normal",
    allowsSpikeForceFallback: false,
  },
  {
    alias: HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
    kind: "production",
    agentId: "marketing-manager",
    workload: "manager_decision",
    priority: "high",
    allowsSpikeForceFallback: false,
  },
  {
    alias: HERMES_INFERENCE_ALIAS_AUTO,
    kind: "spike",
    agentId: RUNTIME_SPIKE_AGENT_ID,
    workload: "manager_decision",
    priority: "high",
    allowsSpikeForceFallback: false,
  },
  {
    alias: HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
    kind: "spike",
    agentId: RUNTIME_SPIKE_AGENT_ID,
    workload: "manager_decision",
    priority: "high",
    allowsSpikeForceFallback: true,
  },
];

const BY_ALIAS = new Map<string, GatewayAliasEntry>(
  REGISTRY.map((entry) => [entry.alias.toLowerCase(), entry]),
);

/** Default when Hermes omits `model` (spike profile compatibility). */
export const GATEWAY_DEFAULT_ALIAS = HERMES_INFERENCE_ALIAS_AUTO;

export function listGatewayAliasEntries(): readonly GatewayAliasEntry[] {
  return REGISTRY;
}

export function normalizeGatewayAlias(raw: string | undefined): string {
  return (raw ?? GATEWAY_DEFAULT_ALIAS).trim().toLowerCase();
}

export function lookupGatewayAlias(raw: string | undefined): GatewayAliasEntry | undefined {
  return BY_ALIAS.get(normalizeGatewayAlias(raw));
}

export function resolveGatewayAlias(raw: string | undefined): GatewayAliasEntry {
  const entry = lookupGatewayAlias(raw);
  if (!entry) {
    const alias = normalizeGatewayAlias(raw);
    throw new RuntimeError(
      "INVALID_REQUEST",
      `Unsupported inference gateway model alias: ${alias}`,
      false,
    );
  }
  return entry;
}

export function resolveWorkloadForAlias(model: string | undefined): WorkloadClass {
  return resolveGatewayAlias(model).workload;
}

export function isSpikeGatewayAgentId(agentId: string): boolean {
  return agentId === RUNTIME_SPIKE_AGENT_ID;
}

export function isProductionGatewayAlias(raw: string | undefined): boolean {
  return lookupGatewayAlias(raw)?.kind === "production";
}

export function isSpikeGatewayAlias(raw: string | undefined): boolean {
  return lookupGatewayAlias(raw)?.kind === "spike";
}

/**
 * Spike-only controlled fallback (C4.1). Registry-controlled — env alone cannot
 * enable forced failure on production aliases.
 */
export function shouldSpikeForceFallback(
  alias: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const entry = lookupGatewayAlias(alias);
  if (!entry?.allowsSpikeForceFallback) {
    return false;
  }
  if (entry.alias === HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE) {
    return true;
  }
  const raw = env.AI_RUNTIME_SPIKE_FORCE_FALLBACK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function expectedProductionAliasForProfile(profileId: string): string {
  return `thealltour/${profileId.trim().toLowerCase()}`;
}
