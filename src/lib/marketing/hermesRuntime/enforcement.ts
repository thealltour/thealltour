/**
 * Phase 2 registration / policy enforcement (test/preflight only).
 * Fail-fast collectors — not used on the hot invoke path.
 */

import { lookupGatewayAlias } from "@/ai-runtime/gateway/alias-registry";
import type { MarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/contract";
import {
  EXCLUDED_HERMES_PROFILE_IDS,
  isExcludedHermesProfile,
} from "@/lib/marketing/hermesRuntime/excludedInventory";
import {
  collectMarketingHermesAliasPreflightIssues,
  collectMarketingHermesRegistryDrift,
  listMarketingHermesProfileIdsOnDisk,
  resolveMarketingHermesProfileFixturesRoot,
} from "@/lib/marketing/hermesRuntime/preflight";
import {
  listMarketingHermesRuntimeContracts,
  MARKETING_HERMES_RUNTIME_REGISTRY,
} from "@/lib/marketing/hermesRuntime/registry";

export type MarketingHermesEnforcementIssue = {
  code:
    | "duplicate_profile_id"
    | "invalid_kind"
    | "missing_runtime"
    | "registry_orphan"
    | "inventory_unregistered"
    | "specialist_credential_policy"
    | "specialist_missing_timeout"
    | "specialist_missing_alias"
    | "specialist_missing_provider"
    | "specialist_missing_transport_retries"
    | "alias_unregistered"
    | "config_drift";
  profileId: string;
  detail: string;
};

const VALID_KINDS = new Set(["department", "specialist", "legacy_channel_editor"]);

export function collectMarketingHermesRegistryStructuralIssues(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
): MarketingHermesEnforcementIssue[] {
  const issues: MarketingHermesEnforcementIssue[] = [];
  const seen = new Map<string, number>();

  for (const contract of contracts) {
    const count = (seen.get(contract.profileId) ?? 0) + 1;
    seen.set(contract.profileId, count);
    if (count > 1) {
      issues.push({
        code: "duplicate_profile_id",
        profileId: contract.profileId,
        detail: `duplicate profileId in registry (count=${count})`,
      });
    }
    if (!VALID_KINDS.has(contract.kind)) {
      issues.push({
        code: "invalid_kind",
        profileId: contract.profileId,
        detail: `invalid kind: ${String(contract.kind)}`,
      });
    }
    if (!contract.runtime || typeof contract.runtime !== "object") {
      issues.push({
        code: "missing_runtime",
        profileId: contract.profileId,
        detail: "runtime block missing",
      });
    }
  }

  return issues;
}

export function collectMarketingHermesSpecialistPolicyIssues(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
): MarketingHermesEnforcementIssue[] {
  const issues: MarketingHermesEnforcementIssue[] = [];

  for (const contract of contracts) {
    if (contract.kind !== "specialist") continue;

    if (!contract.runtime?.modelAlias?.trim()) {
      issues.push({
        code: "specialist_missing_alias",
        profileId: contract.profileId,
        detail: "specialist requires runtime.modelAlias",
      });
    }
    if (!contract.runtime?.provider?.trim()) {
      issues.push({
        code: "specialist_missing_provider",
        profileId: contract.profileId,
        detail: "specialist requires runtime.provider",
      });
    }
    if (!(contract.runtime?.timeoutMs > 0)) {
      issues.push({
        code: "specialist_missing_timeout",
        profileId: contract.profileId,
        detail: "specialist requires runtime.timeoutMs > 0",
      });
    }
    if (contract.credentials?.inferenceGateway !== "launcher_inject") {
      issues.push({
        code: "specialist_credential_policy",
        profileId: contract.profileId,
        detail:
          'specialist credentials.inferenceGateway must be "launcher_inject" (profile_env_legacy forbidden)',
      });
    }
    if (
      typeof contract.failurePolicy?.transportRetries !== "number" ||
      contract.failurePolicy.transportRetries < 1
    ) {
      issues.push({
        code: "specialist_missing_transport_retries",
        profileId: contract.profileId,
        detail: "specialist requires failurePolicy.transportRetries >= 1",
      });
    }
    if (contract.runtime?.modelAlias && !lookupGatewayAlias(contract.runtime.modelAlias)) {
      issues.push({
        code: "alias_unregistered",
        profileId: contract.profileId,
        detail: `gateway alias registry missing ${contract.runtime.modelAlias}`,
      });
    }
  }

  return issues;
}

/**
 * Completeness vs committed fixtures (WSL-safe) or optional live root.
 * Excluded test profiles must be listed in EXCLUDED_HERMES_PROFILE_INVENTORY.
 */
export function collectMarketingHermesCompletenessIssues(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
  profilesRoot: string = resolveMarketingHermesProfileFixturesRoot(),
): MarketingHermesEnforcementIssue[] {
  const issues: MarketingHermesEnforcementIssue[] = [];
  const onDisk = listMarketingHermesProfileIdsOnDisk(profilesRoot).filter(
    (id) => !isExcludedHermesProfile(id),
  );
  const registered = new Set(contracts.map((c) => c.profileId));

  for (const profileId of onDisk) {
    if (!registered.has(profileId)) {
      issues.push({
        code: "inventory_unregistered",
        profileId,
        detail: "profile exists in inventory but is missing from MarketingHermesRuntimeContract registry",
      });
    }
  }

  for (const profileId of registered) {
    if (!onDisk.includes(profileId) && !EXCLUDED_HERMES_PROFILE_IDS.has(profileId)) {
      issues.push({
        code: "registry_orphan",
        profileId,
        detail: "registry entry has no matching profile inventory folder",
      });
    }
  }

  return issues;
}

export function collectAllMarketingHermesEnforcementIssues(): MarketingHermesEnforcementIssue[] {
  const contracts = listMarketingHermesRuntimeContracts();
  const drift = collectMarketingHermesRegistryDrift(contracts).map((d) => ({
    code: "config_drift" as const,
    profileId: d.profileId,
    detail: `${d.kind}: ${d.detail}`,
  }));
  const alias = collectMarketingHermesAliasPreflightIssues(contracts).map((a) => ({
    code: "alias_unregistered" as const,
    profileId: a.profileId,
    detail: a.detail,
  }));

  return [
    ...collectMarketingHermesRegistryStructuralIssues(contracts),
    ...collectMarketingHermesCompletenessIssues(contracts),
    ...collectMarketingHermesSpecialistPolicyIssues(contracts),
    ...drift,
    ...alias,
  ];
}

export function assertMarketingHermesRuntimeEnforcement(): void {
  // Ensure registry constant is evaluated (guards against empty accidental export)
  if (MARKETING_HERMES_RUNTIME_REGISTRY.length < 1) {
    throw new Error("MARKETING_HERMES_RUNTIME_REGISTRY is empty");
  }
  const issues = collectAllMarketingHermesEnforcementIssues();
  if (issues.length === 0) return;
  throw new Error(
    `Marketing Hermes runtime enforcement failed:\n${issues
      .map((i) => `- [${i.code}] ${i.profileId}: ${i.detail}`)
      .join("\n")}`,
  );
}
