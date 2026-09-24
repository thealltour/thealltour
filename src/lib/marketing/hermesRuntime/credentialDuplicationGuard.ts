/**
 * Specialist must not grow profile-local AI_RUNTIME_INFERENCE_GATEWAY_TOKEN copies.
 * Department profile_env_legacy remains allowlisted until Phase 5.
 * Test/preflight only.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";
import { MARKETING_HERMES_DEBT_INVENTORY } from "@/lib/marketing/hermesRuntime/directSpawnDebt";
import { resolveHermesProfilesRoot } from "@/lib/marketing/hermesRuntime/preflight";
import { listMarketingHermesRuntimeContracts } from "@/lib/marketing/hermesRuntime/registry";

export type CredentialDuplicationViolation = {
  profileId: string;
  envPath: string;
  detail: string;
};

const TOKEN = AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV;

function profileEnvHasGatewayToken(envPath: string): boolean {
  if (!existsSync(envPath)) return false;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (key !== TOKEN) continue;
    const value = trimmed.slice(eq + 1).trim();
    if (value.length > 0) return true;
  }
  return false;
}

/** Profiles allowed to keep a profile-local gateway token (department legacy). */
export function listProfileLocalCredentialAllowlist(): Set<string> {
  return new Set(
    MARKETING_HERMES_DEBT_INVENTORY.filter((e) => e.category === "profile_local_credential").map(
      (e) => e.pathOrProfile,
    ),
  );
}

/**
 * Scan live Hermes profile `.env` files (when present).
 * Specialists with a token copy FAIL unless explicitly allowlisted (none should be).
 */
export function findSpecialistCredentialDuplicationViolations(
  profilesRoot: string = resolveHermesProfilesRoot(),
): CredentialDuplicationViolation[] {
  const allow = listProfileLocalCredentialAllowlist();
  const violations: CredentialDuplicationViolation[] = [];

  for (const contract of listMarketingHermesRuntimeContracts()) {
    if (contract.kind !== "specialist" && contract.kind !== "legacy_channel_editor") {
      continue;
    }
    if (allow.has(contract.profileId)) continue;

    const envPath = join(profilesRoot, contract.profileId, ".env");
    if (!profileEnvHasGatewayToken(envPath)) continue;

    violations.push({
      profileId: contract.profileId,
      envPath,
      detail: `${contract.kind} must use launcher_inject — profile .env must not contain ${TOKEN}`,
    });
  }

  return violations;
}

export function assertNoSpecialistGatewayTokenDuplication(profilesRoot?: string): void {
  const violations = findSpecialistCredentialDuplicationViolations(profilesRoot);
  if (violations.length === 0) return;
  throw new Error(
    `Specialist/legacy profile-local gateway token duplication:\n${violations
      .map((v) => `- ${v.profileId}: ${v.detail}`)
      .join("\n")}`,
  );
}
