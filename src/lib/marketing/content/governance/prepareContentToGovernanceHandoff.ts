import { createHash, randomUUID } from "node:crypto";

import { truncateBotText } from "@/lib/marketing/bot/sanitize";
import { evaluateDeterministicClaimSignals } from "@/lib/marketing/content/governance/evaluateDeterministicClaimSignals";
import { extractGovernanceClaims } from "@/lib/marketing/content/governance/extractClaims";
import type {
  ContentToGovernanceHandoffResult,
  PrepareContentToGovernanceHandoffInput,
  StructuredGovernanceReviewRequest,
} from "@/lib/marketing/content/governance/types";
import { GOVERNANCE_REVIEW_REQUEST_CONTRACT } from "@/lib/marketing/content/governance/types";

export function buildGovernanceReviewIdempotencyKey(input: {
  assignmentId: string | null;
  draftBody: string;
  priorRevision: number;
}): string {
  const seed = [input.assignmentId ?? "none", String(input.priorRevision), input.draftBody.slice(0, 500)].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function prepareContentToGovernanceHandoff(
  input: PrepareContentToGovernanceHandoffInput,
): ContentToGovernanceHandoffResult {
  const now = input.now ?? new Date();
  const assignment = input.assignment ?? null;
  const selectedAgenda = input.selectedAgenda ?? null;
  const contentPlan = input.contentPlan ?? input.draft.contentPlan ?? null;
  const assignmentId = input.draft.assignmentId ?? assignment?.assignmentId ?? null;
  const selectedAgendaId = selectedAgenda?.id ?? assignment?.selectedAgendaId ?? null;

  if (!input.draft.body?.trim()) {
    throw new Error("governance_handoff_requires_draft_body");
  }

  const priorRevision = input.priorRevision ?? 0;
  const idempotencyKey = buildGovernanceReviewIdempotencyKey({
    assignmentId,
    draftBody: input.draft.body,
    priorRevision,
  });
  const reviewId = `gr_${idempotencyKey.slice(0, 24)}`;

  const evidenceRefs = (assignment?.evidenceRefs ?? contentPlan?.evidenceRefs ?? []).slice(0, 12);
  const claims = extractGovernanceClaims({
    draft: input.draft,
    contentPlan,
    allowedEvidenceIds: new Set(evidenceRefs.map((ref) => ref.evidenceId)),
  });
  const preflightSignals = evaluateDeterministicClaimSignals({
    draft: input.draft,
    assignment,
    contentPlan,
    now,
  });

  const request: StructuredGovernanceReviewRequest = {
    contract: GOVERNANCE_REVIEW_REQUEST_CONTRACT,
    reviewId,
    assignmentId,
    selectedAgendaId,
    createdAt: now.toISOString(),
    topic: assignment?.topic ?? input.draft.agenda ?? selectedAgenda?.title ?? null,
    objective: assignment?.objective ?? selectedAgenda?.contentObjective ?? null,
    format: contentPlan?.recommendedFormats?.[0]?.format ?? assignment?.formatHints?.[0]?.format ?? null,
    channel: input.draft.channel || input.channel,
    title: input.draft.title ?? null,
    body: truncateBotText(input.draft.body, 4000) ?? input.draft.body,
    draft: {
      title: input.draft.title ?? null,
      body: truncateBotText(input.draft.body, 4000) ?? input.draft.body,
      channel: input.draft.channel,
      agenda: input.draft.agenda,
      assignmentId,
      sourceReferences: (input.draft.sourceReferences ?? []).slice(0, 12),
    },
    contentPlan,
    claims: claims.slice(0, 16),
    evidenceRefs,
    commercialIntent: assignment?.commercialIntent ?? selectedAgenda?.commercialIntent ?? null,
    matchedProductIds: assignment?.matchedProductIds ?? selectedAgenda?.matchedProductIds ?? [],
    cta: contentPlan?.ctaStrategy ?? null,
    constraints: [
      "do not publish",
      "governance evaluates only — do not rewrite content",
      "preserve assignment/agenda ownership boundaries",
      ...(assignment?.constraints ?? []).slice(0, 8),
    ].slice(0, 16),
    priorRevision,
    productId: input.productId,
    campaignId: null,
    agendaId: selectedAgendaId,
    agendaKey: input.draft.agenda,
    preflightSignals,
    observability: {
      reviewId,
      assignmentId,
      claimCount: claims.length,
      unsupportedClaimCount: preflightSignals.unsupportedClaims.length,
      evidenceGapCount: preflightSignals.evidenceGaps.length,
      revisionNumber: priorRevision,
      requestedAt: now.toISOString(),
    },
  };

  return { request };
}

export function createEphemeralGovernanceReviewId(): string {
  return randomUUID();
}
