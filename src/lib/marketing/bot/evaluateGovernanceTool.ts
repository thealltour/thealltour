import "server-only";

import { compactGovernance, mapWorkflowToBotResult } from "@/lib/marketing/bot/mapBotResult";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import type {
  CompactGovernanceResult,
  EvaluateGovernanceInput,
  MarketingBotDeps,
  MarketingBotResult,
  ReviewGeneratedContentInput,
} from "@/lib/marketing/bot/types";

export async function evaluateGovernanceTool(
  input: EvaluateGovernanceInput,
  deps: MarketingBotDeps = {},
): Promise<CompactGovernanceResult> {
  const workflow = await runReviewWorkflow(input, deps);
  return compactGovernance(workflow);
}

export async function reviewGeneratedContent(
  input: ReviewGeneratedContentInput,
  deps: MarketingBotDeps = {},
): Promise<MarketingBotResult> {
  const workflow = await runReviewWorkflow(input, deps);
  return mapWorkflowToBotResult(workflow, {
    title: input.title ?? null,
    body: input.body,
    channel: input.channel,
  });
}

async function runReviewWorkflow(input: EvaluateGovernanceInput, deps: MarketingBotDeps) {
  if (!input.body?.trim()) throw new MarketingBotValidationError("body is required");
  if (!input.channel?.trim()) throw new MarketingBotValidationError("channel is required");
  const evaluate =
    deps.evaluateWorkflow ??
    (await import("@/lib/marketing/governance/evaluateGovernanceWorkflow")).evaluateGovernanceWorkflow;
  return evaluate(
    {
      title: input.title,
      body: input.body,
      channel: input.channel,
      productId: input.productId,
      campaignId: input.campaignId,
      agendaId: input.agendaId,
      agendaKey: input.agendaKey,
    },
    { now: deps.now },
  );
}
