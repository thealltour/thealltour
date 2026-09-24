/**
 * Marketing Artifact Contract (Phase 3A).
 *
 * WHAT artifact is produced and lifecycle dependency metadata.
 * Separated from Runtime + Semantic contracts; linked by artifactId / profileId.
 *
 * Phase 3A: metadata + validation only — does not drive ensure/lifecycle code.
 */

export type MarketingArtifactGenerateFailPolicy =
  | "fail_closed"
  | "preserve_previous"
  | "deterministic_fallback";

export type MarketingArtifactContract = {
  artifactId: string;
  /** Same string as persisted `contract` field (e.g. instagram-visual-role-plan-v1). */
  contractVersion: string;
  relativePath: string;
  /** Hermes profileId or deterministic producer id (e.g. deterministic:card-layout). */
  producedBy: string;
  /** Upstream artifactIds this artifact depends on. */
  dependsOn: string[];
  lifecycle: {
    /** Field / source names matching existing fingerprint code. */
    fingerprintSources: string[];
    reuseWhen: string;
    staleWhen: string;
  };
  failurePolicy?: {
    onGenerateFail: MarketingArtifactGenerateFailPolicy;
    repairAttempts?: number;
    materializeInRepairLoop?: boolean;
  };
  legacy?: {
    fallbackAllowed: boolean;
    notes?: string[];
  };
};
