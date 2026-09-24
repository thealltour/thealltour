/**
 * Test/preflight helpers for Marketing Hermes runtime registry drift and
 * gateway alias registration. Not used on the hot invoke path.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lookupGatewayAlias } from "@/ai-runtime/gateway/alias-registry";
import type { MarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/contract";
import {
  EXCLUDED_HERMES_PROFILE_IDS,
  isExcludedHermesProfile,
} from "@/lib/marketing/hermesRuntime/excludedInventory";
import {
  listMarketingHermesRuntimeContracts,
  listRegisteredMarketingHermesProfileIds,
} from "@/lib/marketing/hermesRuntime/registry";

/** @deprecated Prefer EXCLUDED_HERMES_PROFILE_IDS / isExcludedHermesProfile */
export const NON_MARKETING_HERMES_PROFILE_IDS = EXCLUDED_HERMES_PROFILE_IDS;

export type HermesProfileModelConfig = {
  modelDefault: string;
  modelProvider: string;
};

/** Committed model.default / model.provider excerpts for drift tests (WSL-safe). */
export function resolveMarketingHermesProfileFixturesRoot(): string {
  // hermesRuntime/__fixtures__/profiles — stable relative to this module file.
  return join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "profiles");
}

export function resolveHermesProfilesRoot(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const hermesHome =
    env.HERMES_HOME?.trim() || join(env.HOME?.trim() || homedir(), ".hermes");
  return join(hermesHome, "profiles");
}

/**
 * Minimal config.yaml model field reader (test/preflight only — not on invoke path).
 */
export function readHermesProfileModelConfig(
  profileId: string,
  profilesRoot: string,
): HermesProfileModelConfig {
  const configPath = join(profilesRoot, profileId, "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`Hermes profile config missing: ${configPath}`);
  }
  const text = readFileSync(configPath, "utf8");
  if (/^\s*#\s*Stub\b/i.test(text)) {
    throw new Error(`Hermes profile config is a stub (not production): ${configPath}`);
  }
  const modelBlock = text.match(/^model:\r?\n((?:[ \t]+.+\r?\n)+)/m);
  const block = modelBlock?.[1] ?? text;
  const defaultMatch = block.match(/^[ \t]+default:\s*(.+)\s*$/m);
  const providerMatch = block.match(/^[ \t]+provider:\s*(.+)\s*$/m);
  const modelDefault = defaultMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  const modelProvider = providerMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!modelDefault || !modelProvider) {
    throw new Error(
      `Hermes profile ${profileId}: could not parse model.default / model.provider from ${configPath}`,
    );
  }
  return { modelDefault, modelProvider };
}


export function listHermesProfileIdsOnDisk(profilesRoot: string): string[] {
  if (!existsSync(profilesRoot)) return [];
  return readdirSync(profilesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function listMarketingHermesProfileIdsOnDisk(profilesRoot: string): string[] {
  return listHermesProfileIdsOnDisk(profilesRoot).filter((id) => !isExcludedHermesProfile(id));
}

export type RegistryDriftIssue = {
  profileId: string;
  kind: "missing_on_disk" | "missing_in_registry" | "model_alias_mismatch" | "provider_mismatch";
  detail: string;
};

/**
 * Compare registry ↔ profile configs.
 * Default profiles root = committed fixtures (WSL/CI safe).
 * Pass `resolveHermesProfilesRoot()` + `HERMES_RUNTIME_LIVE_PROFILE_DRIFT=1` on Pi
 * to catch silent live-config drift.
 */
export function collectMarketingHermesRegistryDrift(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
  profilesRoot: string = resolveMarketingHermesProfileFixturesRoot(),
): RegistryDriftIssue[] {
  const issues: RegistryDriftIssue[] = [];
  const onDisk = new Set(listMarketingHermesProfileIdsOnDisk(profilesRoot));
  const registered = new Set(contracts.map((c) => c.profileId));

  for (const profileId of registered) {
    if (!onDisk.has(profileId)) {
      issues.push({
        profileId,
        kind: "missing_on_disk",
        detail: `registry lists ${profileId} but profiles dir has no such folder`,
      });
      continue;
    }
    const contract = contracts.find((c) => c.profileId === profileId)!;
    let live: HermesProfileModelConfig;
    try {
      live = readHermesProfileModelConfig(profileId, profilesRoot);
    } catch (error) {
      issues.push({
        profileId,
        kind: "missing_on_disk",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (live.modelDefault !== contract.runtime.modelAlias) {
      issues.push({
        profileId,
        kind: "model_alias_mismatch",
        detail: `registry=${contract.runtime.modelAlias} config.yaml=${live.modelDefault}`,
      });
    }
    if (live.modelProvider !== contract.runtime.provider) {
      issues.push({
        profileId,
        kind: "provider_mismatch",
        detail: `registry=${contract.runtime.provider} config.yaml=${live.modelProvider}`,
      });
    }
  }

  for (const profileId of onDisk) {
    if (!registered.has(profileId)) {
      issues.push({
        profileId,
        kind: "missing_in_registry",
        detail: `on-disk marketing profile ${profileId} is not in MARKETING_HERMES_RUNTIME_REGISTRY`,
      });
    }
  }

  return issues;
}


export type AliasPreflightIssue = {
  profileId: string;
  modelAlias: string;
  detail: string;
};

/** Every registry modelAlias must exist in the AI Runtime gateway alias registry. */
export function collectMarketingHermesAliasPreflightIssues(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
): AliasPreflightIssue[] {
  const issues: AliasPreflightIssue[] = [];
  for (const contract of contracts) {
    const alias = contract.runtime.modelAlias;
    if (!lookupGatewayAlias(alias)) {
      issues.push({
        profileId: contract.profileId,
        modelAlias: alias,
        detail: `gateway alias registry has no entry for ${alias}`,
      });
    }
  }
  return issues;
}

export type Phase4SpecialistCutoverIssue = {
  profileId: string;
  layer: "runtime_registry" | "profile_config" | "gateway_registry";
  detail: string;
};

/**
 * Phase 4 four-layer check for specialist production aliases:
 * profileId → expected alias → runtime registry → profile config → gateway registry.
 */
export function collectPhase4SpecialistCutoverIssues(
  contracts: readonly MarketingHermesRuntimeContract[] = listMarketingHermesRuntimeContracts(),
  profilesRoot: string = resolveMarketingHermesProfileFixturesRoot(),
): Phase4SpecialistCutoverIssue[] {
  const issues: Phase4SpecialistCutoverIssue[] = [];
  for (const contract of contracts) {
    if (contract.kind !== "specialist") continue;
    const expected = `thealltour/${contract.profileId}`;

    if (contract.runtime.modelAlias !== expected) {
      issues.push({
        profileId: contract.profileId,
        layer: "runtime_registry",
        detail: `modelAlias ${contract.runtime.modelAlias} !== ${expected}`,
      });
    }

    try {
      const live = readHermesProfileModelConfig(contract.profileId, profilesRoot);
      if (live.modelDefault !== expected) {
        issues.push({
          profileId: contract.profileId,
          layer: "profile_config",
          detail: `config.yaml default ${live.modelDefault} !== ${expected}`,
        });
      }
    } catch (error) {
      issues.push({
        profileId: contract.profileId,
        layer: "profile_config",
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    const entry = lookupGatewayAlias(expected);
    if (!entry) {
      issues.push({
        profileId: contract.profileId,
        layer: "gateway_registry",
        detail: `missing gateway alias ${expected}`,
      });
    } else if (
      entry.kind !== "production" ||
      entry.agentId !== contract.profileId ||
      entry.workload !== "content_draft" ||
      entry.priority !== "normal" ||
      entry.allowsSpikeForceFallback
    ) {
      issues.push({
        profileId: contract.profileId,
        layer: "gateway_registry",
        detail: `alias entry mismatch kind=${entry.kind} agentId=${entry.agentId} workload=${entry.workload} priority=${entry.priority} forceFallback=${entry.allowsSpikeForceFallback}`,
      });
    }
  }
  return issues;
}

export function assertMarketingHermesRegistryHealthy(): void {
  const drift = collectMarketingHermesRegistryDrift();
  if (drift.length > 0) {
    throw new Error(
      `Marketing Hermes registry drift:\n${drift
        .map((i) => `- ${i.profileId}: ${i.kind} (${i.detail})`)
        .join("\n")}`,
    );
  }
  const aliasIssues = collectMarketingHermesAliasPreflightIssues();
  if (aliasIssues.length > 0) {
    throw new Error(
      `Marketing Hermes alias preflight failed:\n${aliasIssues
        .map((i) => `- ${i.profileId}: ${i.modelAlias} — ${i.detail}`)
        .join("\n")}`,
    );
  }
  const phase4 = collectPhase4SpecialistCutoverIssues();
  if (phase4.length > 0) {
    throw new Error(
      `Phase 4 specialist cutover preflight failed:\n${phase4
        .map((i) => `- ${i.profileId} [${i.layer}]: ${i.detail}`)
        .join("\n")}`,
    );
  }
}

export { listRegisteredMarketingHermesProfileIds };
