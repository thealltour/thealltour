/**
 * STEP E-4G: exclude verification/test research artifacts from Agenda curation.
 *
 * Reuses operations `isVerificationRecord` on primary-signal metadata.
 * Legacy compatibility: explicit bracket marker `[verification]` already used by
 * STEP 3-8/3-9 fixtures (e.g. "[VERIFICATION] …", "performance: [verification] …").
 * This is NOT a broad keyword blacklist — bare "verification" without brackets does not match.
 */
import {
  isVerificationRecord,
  type VerificationRecordInput,
} from "@/lib/marketing/operations/verification";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

/** Canonical fixture title marker used by STEP 3-x verification artifacts. */
const VERIFICATION_BRACKET_TITLE_RE = /\[[\s]*verification[\s]*\]/i;

export function hasVerificationBracketTitleMarker(title: string | null | undefined): boolean {
  return VERIFICATION_BRACKET_TITLE_RE.test(title ?? "");
}

export function verificationInputFromResearchSignal(
  signal: ResearchSignal,
): VerificationRecordInput {
  const metadata = signal.metadata ?? null;
  const asString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value : null;

  return {
    metadata,
    purpose: asString(metadata?.purpose),
    candidateId: asString(metadata?.candidateId),
    reviewId: asString(metadata?.reviewId),
    logicalObservationKey: asString(metadata?.logicalObservationKey),
    logicalRunKey: asString(metadata?.logicalRunKey),
    routineId: asString(metadata?.routineId),
  };
}

/**
 * True when a ResearchBrief / AgendaCandidate is an explicit verification/test artifact.
 * Does not treat all performance_memory / content_performance records as fixtures.
 */
export function isVerificationResearchArtifact(input: {
  title?: string | null;
  signal?: ResearchSignal | null;
}): boolean {
  if (input.signal && isVerificationRecord(verificationInputFromResearchSignal(input.signal))) {
    return true;
  }
  // Legacy rows / titles that already embed the canonical STEP 3-x bracket marker.
  if (hasVerificationBracketTitleMarker(input.title)) {
    return true;
  }
  return false;
}
