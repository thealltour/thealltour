/**
 * Phase 3B: thin Artifact Contract helpers for lifecycle/failure metadata.
 *
 * Not a generic lifecycle engine — lookup + invariants only.
 */

import type {
  MarketingArtifactContract,
  MarketingArtifactGenerateFailPolicy,
} from "@/lib/marketing/agentContracts/artifactContract";
import {
  getMarketingArtifactContract,
  requireMarketingArtifactContract,
} from "@/lib/marketing/agentContracts/artifactRegistry";

export type ArtifactFailurePolicy = NonNullable<MarketingArtifactContract["failurePolicy"]>;

/** Artifacts with Phase 3B runtime wiring (behavior parity preserved). */
export const PHASE_3B_WIRED_ARTIFACT_IDS = [
  "instagram-visual-role-plan-v1",
  "shared-visual-plan-v1",
  "manual-astra-handoff-v1",
] as const;

export type Phase3bWiredArtifactId = (typeof PHASE_3B_WIRED_ARTIFACT_IDS)[number];

/** Artifacts with Phase 3C editorial/presentation lifecycle wiring. */
export const PHASE_3C_WIRED_ARTIFACT_IDS = [
  "editorial-narrative-plan-v1",
  "instagram-carousel-plan-v1",
  "instagram-card-copy-v1",
  "instagram-caption-v1",
  "card-presentation-plan-v1",
] as const;

export type Phase3cWiredArtifactId = (typeof PHASE_3C_WIRED_ARTIFACT_IDS)[number];

export function getArtifactLifecycleContract(
  artifactId: string,
): MarketingArtifactContract["lifecycle"] {
  return requireMarketingArtifactContract(artifactId).lifecycle;
}

export function getArtifactFailurePolicy(artifactId: string): ArtifactFailurePolicy {
  const policy = requireMarketingArtifactContract(artifactId).failurePolicy;
  if (!policy) {
    throw new Error(`Artifact ${artifactId} has no failurePolicy in MarketingArtifactContract`);
  }
  return policy;
}

export function getArtifactDependencies(artifactId: string): readonly string[] {
  return requireMarketingArtifactContract(artifactId).dependsOn;
}

/**
 * Assert that `artifactId` declares `dependencyId` in dependsOn.
 * Used by Astra (and similar) so dependency facts are not duplicated ad hoc.
 */
export function assertArtifactDependsOn(artifactId: string, dependencyId: string): void {
  const deps = getArtifactDependencies(artifactId);
  if (!deps.includes(dependencyId)) {
    throw new Error(
      `Artifact contract drift: ${artifactId} does not declare dependsOn ${dependencyId}`,
    );
  }
}

/** Repair attempt budget from contract (defaults to 1 if unset). */
export function getArtifactRepairAttemptBudget(artifactId: string): number {
  const attempts = getArtifactFailurePolicy(artifactId).repairAttempts;
  if (typeof attempts === "number" && attempts >= 1) return Math.floor(attempts);
  return 1;
}

export function assertFingerprintSourcesInclude(
  artifactId: string,
  requiredSources: readonly string[],
): void {
  const sources = new Set(getArtifactLifecycleContract(artifactId).fingerprintSources);
  for (const required of requiredSources) {
    if (!sources.has(required)) {
      throw new Error(
        `Artifact contract drift: ${artifactId} missing fingerprintSource ${required}`,
      );
    }
  }
}

/**
 * Apply onGenerateFail policy for preserve_previous / fail_closed style results.
 * Domain code builds the result objects; this only validates the policy choice.
 */
export function requireOnGenerateFail(
  artifactId: string,
  expected: MarketingArtifactGenerateFailPolicy,
): void {
  const actual = getArtifactFailurePolicy(artifactId).onGenerateFail;
  if (actual !== expected) {
    throw new Error(
      `Artifact contract drift: ${artifactId} onGenerateFail=${actual}, expected ${expected}`,
    );
  }
}

/**
 * Assert materializeInRepairLoop matches current pipeline placement.
 * Does not move materialize — parity/assertion only.
 */
export function requireMaterializeInRepairLoop(
  artifactId: string,
  expected: boolean,
): void {
  const actual = getArtifactFailurePolicy(artifactId).materializeInRepairLoop;
  if (actual !== expected) {
    throw new Error(
      `Artifact contract drift: ${artifactId} materializeInRepairLoop=${String(actual)}, expected ${String(expected)}`,
    );
  }
}

export function isPhase3bWiredArtifact(artifactId: string): boolean {
  return (PHASE_3B_WIRED_ARTIFACT_IDS as readonly string[]).includes(artifactId);
}

export function isPhase3cWiredArtifact(artifactId: string): boolean {
  return (PHASE_3C_WIRED_ARTIFACT_IDS as readonly string[]).includes(artifactId);
}

export function lookupWiredArtifactContract(
  artifactId: Phase3bWiredArtifactId | Phase3cWiredArtifactId,
): MarketingArtifactContract {
  const entry = getMarketingArtifactContract(artifactId);
  if (!entry) {
    throw new Error(`Unknown Phase 3B/3C wired artifact: ${artifactId}`);
  }
  return entry;
}
