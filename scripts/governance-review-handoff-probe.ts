#!/usr/bin/env npx tsx
/**
 * Read-only probe for CS → GA governance handoff preparation.
 * No Hermes invocation, no publication, no external side effects.
 */
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { prepareContentToGovernanceHandoff } from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
import { normalizeGovernanceReviewResult } from "@/lib/marketing/content/governance/normalizeGovernanceReviewResult";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";

async function main() {
  const mm = prepareManagerToContentHandoff({
    title: "Probe — Japan autumn guidance",
    summary: "Official travel guidance update.",
    commercialIntent: "informational",
    idempotencyKey: "probe-step-3-6",
  });

  const draft = {
    title: "Japan autumn guidance",
    body: "Official guidance suggests autumn travel planning is useful.",
    channel: "threads",
    agenda: mm.selectedAgenda.title,
    sourceReferences: [],
    assignmentId: mm.contentAssignment.assignmentId,
    contentPlan: mm.contentPlanScaffold,
  };

  const handoff = prepareContentToGovernanceHandoff({
    draft,
    assignment: mm.contentAssignment,
    selectedAgenda: mm.selectedAgenda,
    contentPlan: mm.contentPlanScaffold,
    productId: "98a889e9-fbc4-41e3-8302-0d2b042fbe0a",
    channel: "threads",
  });

  const normalized = normalizeGovernanceReviewResult(
    {
      decision: "ALLOW",
      riskScore: 0,
      reasons: ["NO_RISK_SIGNAL"],
      revisionHints: [],
      humanApprovalRequired: false,
      semanticAvailable: true,
    },
    handoff.request,
  );

  console.log(
    JSON.stringify(
      {
        requestContract: handoff.request.contract,
        reviewId: handoff.request.reviewId,
        assignmentId: handoff.request.assignmentId,
        claimCount: handoff.request.claims.length,
        evidenceCount: handoff.request.evidenceRefs.length,
        decisionContract: normalized.structured.contract,
        decision: normalized.structured.decision,
        containsEmbeddingLeak: jsonContainsForbiddenBotLeak(handoff.request),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
