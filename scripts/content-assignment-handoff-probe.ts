#!/usr/bin/env npx tsx
/**
 * Read-only probe for MM → CS ContentAssignment handoff.
 * No Hermes invocation, no publication, no external side effects.
 */
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";

async function main() {
  const store = createInMemoryContentAssignmentStore();
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Probe topic — Japan autumn guidance",
      summary: "Official travel guidance update for autumn season.",
      commercialIntent: "informational",
      idempotencyKey: "probe-step-3-5",
    },
    { store },
  );

  console.log(
    JSON.stringify(
      {
        selectedAgendaContract: handoff.selectedAgenda.contract,
        assignmentContract: handoff.contentAssignment.contract,
        planContract: handoff.contentPlanScaffold.contract,
        assignmentId: handoff.contentAssignment.assignmentId,
        formatCount: handoff.contentAssignment.formatHints.length,
        evidenceCount: handoff.contentAssignment.evidenceRefs.length,
        productless: handoff.contentAssignment.matchedProductIds.length === 0,
        containsEmbeddingLeak: jsonContainsForbiddenBotLeak(handoff),
        topFormat: handoff.contentAssignment.formatHints[0]?.format ?? null,
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
