/**
 * Scoped channel regenerate freshness — hard package-reuse and soft identical-body guards.
 */

import type {
  PublishableChannelContent,
  PublishableGenerationFailureCategory,
} from "@/lib/marketing/publishable/contracts";

export function normalizePublishableBodyForCompare(body: string | null | undefined): string {
  return (body ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function publishableBodiesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizePublishableBodyForCompare(a);
  const right = normalizePublishableBodyForCompare(b);
  if (!left || !right) return false;
  return left === right;
}

export type FreshRegenerationVerdict =
  | { ok: true; bodyChanged: boolean }
  | {
      ok: false;
      reason: "package_reuse_or_zero_attempts" | "body_unchanged";
      failureMessage: string;
      bodyChanged: boolean;
    };

/**
 * Scoped regenerate must look like a real LLM write — not specialist package reuse
 * (attemptCount 0) and not an identical prior body.
 */
export function evaluateScopedRegenerationFreshness(input: {
  prior: PublishableChannelContent | undefined;
  next: PublishableChannelContent;
}): FreshRegenerationVerdict {
  const { prior, next } = input;
  const priorBody = prior?.body?.trim() ? prior.body : null;
  const bodyChanged = priorBody ? !publishableBodiesEqual(priorBody, next.body) : true;
  const attemptCount = next.provenance.attemptCount ?? 0;

  if (next.provenance.composer !== "llm" || next.publishableSuccess !== true) {
    return {
      ok: false,
      reason: "package_reuse_or_zero_attempts",
      failureMessage:
        next.provenance.failureMessage ??
        "scoped_regenerate_requires_llm_publishable_success",
      bodyChanged,
    };
  }

  // Specialist package reuse stamps attemptCount: 0 with a prior-matching body.
  if (attemptCount < 1) {
    return {
      ok: false,
      reason: "package_reuse_or_zero_attempts",
      failureMessage: "scoped_regenerate_rejected_zero_attempt_reuse",
      bodyChanged,
    };
  }

  if (priorBody && !bodyChanged) {
    return {
      ok: false,
      reason: "body_unchanged",
      failureMessage: "scoped_regenerate_rejected_identical_body",
      bodyChanged: false,
    };
  }

  return { ok: true, bodyChanged };
}

export function markStaleScopedRegeneration(input: {
  content: PublishableChannelContent;
  failureMessage: string;
  failureCategory?: PublishableGenerationFailureCategory;
}): PublishableChannelContent {
  return {
    ...input.content,
    status: "generation_failed",
    publishableSuccess: false,
    needsRegeneration: true,
    provenance: {
      ...input.content.provenance,
      failureCategory: input.failureCategory ?? "schema_validation",
      failureMessage: input.failureMessage,
    },
  };
}

/** Prompt block: force a fresh wording pass without changing factual boundary. */
export function formatForceRegenerateAvoidBlock(input: {
  priorBody?: string | null;
  regenerationNonce: string;
}): string {
  const prior = (input.priorBody ?? "").trim();
  if (!prior) {
    return [
      "FORCE_REGENERATE:",
      `regenerationNonce=${input.regenerationNonce}`,
      "Produce a fresh channel draft. Do not copy any previous channel body verbatim.",
    ].join("\n");
  }
  return [
    "FORCE_REGENERATE:",
    `regenerationNonce=${input.regenerationNonce}`,
    "Rewrite with substantially different wording, sentence order, and local emphasis.",
    "Keep the same factual boundary / approved Canonical claims. Do not invent new facts.",
    "Do NOT reproduce PRIOR_BODY verbatim or with only trivial synonym swaps.",
    `PRIOR_BODY_TO_AVOID:\n${prior.slice(0, 1200)}`,
  ].join("\n");
}

export function mergeForceRegenerateQualityRevision(input: {
  existing: {
    hints: string[];
    priorBody?: string | null;
    reasons?: string[];
  } | null | undefined;
  priorBody: string | null;
  regenerationNonce: string;
}): {
  hints: string[];
  priorBody: string | null;
  reasons: string[];
} {
  const hints = [
    ...(input.existing?.hints ?? []),
    "FORCE_REGENERATE: rewrite with fresh wording; do not reproduce prior body verbatim.",
  ].slice(0, 8);
  const reasons = [
    ...(input.existing?.reasons ?? []),
    `force_regenerate:${input.regenerationNonce}`,
  ].slice(0, 6);
  return {
    hints,
    priorBody: input.existing?.priorBody?.trim()
      ? input.existing.priorBody
      : input.priorBody,
    reasons,
  };
}

export type ChannelRegenerationDiagnostics = {
  status: "generated" | "failed";
  attemptCount: number;
  latencyMs: number | null;
  bodyChanged: boolean;
  failureCategory: string | null;
  failureMessage: string | null;
};

export function buildChannelRegenerationDiagnostics(input: {
  slot: PublishableChannelContent | undefined;
  priorBody: string | null;
}): ChannelRegenerationDiagnostics {
  const slot = input.slot;
  if (!slot) {
    return {
      status: "failed",
      attemptCount: 0,
      latencyMs: null,
      bodyChanged: false,
      failureCategory: "unknown",
      failureMessage: "channel_slot_missing",
    };
  }
  const bodyChanged = input.priorBody
    ? !publishableBodiesEqual(input.priorBody, slot.body)
    : Boolean(slot.body?.trim());
  const ok =
    slot.provenance.composer === "llm" &&
    slot.publishableSuccess === true &&
    (slot.provenance.attemptCount ?? 0) >= 1 &&
    bodyChanged;
  return {
    status: ok ? "generated" : "failed",
    attemptCount: slot.provenance.attemptCount ?? 0,
    latencyMs: slot.provenance.latencyMs ?? null,
    bodyChanged,
    failureCategory: ok ? null : (slot.provenance.failureCategory ?? "unknown"),
    failureMessage: ok ? null : (slot.provenance.failureMessage ?? null),
  };
}
