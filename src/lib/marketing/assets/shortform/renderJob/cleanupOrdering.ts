/**
 * Ephemeral cleanup eligibility relative to VideoRenderJob lifecycle.
 * SV-1 ephemeralSuccessTtlMs = 0 means "eligible immediately after success",
 * not "delete while still creating the durable final".
 */

export const SHORTFORM_RENDER_CLEANUP_ORDERING_STEPS = [
  "create_source_or_intermediate",
  "persist_durable_final_artifact",
  "commit_manifest_or_provenance",
  "mark_job_ready",
  "ephemeral_cleanup_eligible",
] as const;

export type ShortformRenderCleanupOrderingStep =
  (typeof SHORTFORM_RENDER_CLEANUP_ORDERING_STEPS)[number];

export function isEphemeralCleanupEligibleAfterReady(input: {
  jobStatus: string;
  durableFinalPersisted: boolean;
  manifestCommitted: boolean;
}): boolean {
  return (
    input.jobStatus === "READY" &&
    input.durableFinalPersisted &&
    input.manifestCommitted
  );
}

/** Domain invariant: READY requires durable output path identity (filesystem check is worker/SV-8). */
export function assertReadyRequiresDurableOutputPath(outputArtifactPath: string | null | undefined) {
  if (!outputArtifactPath || !outputArtifactPath.trim()) {
    throw new Error("READY_REQUIRES_OUTPUT_ARTIFACT_PATH");
  }
}
