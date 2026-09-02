import { VERIFICATION_ROUTINE_ID, VERIFICATION_PURPOSE } from "@/lib/marketing/review/verification/buildVerificationCandidate";

export const STEP_3_9_VERIFICATION_ROUTINE_ID = "step-3-9-verification" as const;
export const STEP_3_9_VERIFICATION_PURPOSE = "step-3-9-final-verification" as const;
export const STEP_3_10_VERIFICATION_ROUTINE_ID = "step-3-10-verification" as const;
export const STEP_3_10_VERIFICATION_PURPOSE = "step-3-10-final-verification" as const;

export const VERIFICATION_ROUTINE_IDS = [
  VERIFICATION_ROUTINE_ID,
  STEP_3_9_VERIFICATION_ROUTINE_ID,
  STEP_3_10_VERIFICATION_ROUTINE_ID,
] as const;

export const VERIFICATION_CANDIDATE_IDS = [
  "cmc_step_3_8_verification",
  "cmc_step_3_9_verification",
  "cmc_step_3_10_verification",
] as const;

export const VERIFICATION_PURPOSES = [
  VERIFICATION_PURPOSE,
  STEP_3_9_VERIFICATION_PURPOSE,
  STEP_3_10_VERIFICATION_PURPOSE,
] as const;

export type VerificationRecordInput = {
  routineId?: string | null;
  candidateId?: string | null;
  logicalRunKey?: string | null;
  logicalObservationKey?: string | null;
  reviewId?: string | null;
  metadata?: Record<string, unknown> | null;
  purpose?: string | null;
};

function metadataPurpose(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.purpose;
  return typeof value === "string" ? value : null;
}

export function isVerificationRecord(input: VerificationRecordInput): boolean {
  if (input.metadata?.verification === true) return true;

  const purpose = input.purpose ?? metadataPurpose(input.metadata);
  if (purpose && (VERIFICATION_PURPOSES as readonly string[]).includes(purpose)) return true;

  if (input.routineId && (VERIFICATION_ROUTINE_IDS as readonly string[]).includes(input.routineId)) {
    return true;
  }

  if (input.candidateId && (VERIFICATION_CANDIDATE_IDS as readonly string[]).includes(input.candidateId)) {
    return true;
  }

  if (input.reviewId?.startsWith("hmr_step_3_")) return true;

  if (input.logicalRunKey) {
    for (const routineId of VERIFICATION_ROUTINE_IDS) {
      if (input.logicalRunKey.startsWith(`${routineId}:`)) return true;
    }
  }

  if (input.logicalObservationKey?.startsWith("step-3-9-verification:")) return true;
  if (input.logicalObservationKey?.startsWith("step-3-10-verification:")) return true;

  return false;
}

export function filterProductionRecords<T>(
  rows: T[],
  toInput: (row: T) => VerificationRecordInput,
): T[] {
  return rows.filter((row) => !isVerificationRecord(toInput(row)));
}
