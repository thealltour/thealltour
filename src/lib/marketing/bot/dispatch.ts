import "server-only";

import { evaluateGovernanceTool, reviewGeneratedContent } from "@/lib/marketing/bot/evaluateGovernanceTool";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { getMarketingContextTool } from "@/lib/marketing/bot/getMarketingContextTool";
import { buildContentBriefTool, prepareMarketingTask } from "@/lib/marketing/bot/prepareMarketingTask";
import { getPerformanceEvidenceTool } from "@/lib/marketing/bot/getPerformanceEvidenceTool";
import { getResearchContextTool } from "@/lib/marketing/bot/getResearchContextTool";
import { createContentAssignmentTool } from "@/lib/marketing/bot/createContentAssignmentTool";
import { getContentAssignmentTool } from "@/lib/marketing/bot/getContentAssignmentTool";
import { getAssignmentResearchEvidenceTool } from "@/lib/marketing/bot/getAssignmentResearchEvidenceTool";
import { runDepartmentOrchestrationTool } from "@/lib/marketing/bot/runDepartmentOrchestrationTool";
import { searchMarketingMemoryTool } from "@/lib/marketing/bot/searchMarketingMemoryTool";
import { MARKETING_BOT_TOOL_NAMES, type MarketingBotDeps, type MarketingBotToolName } from "@/lib/marketing/bot/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MarketingBotValidationError("JSON object body is required");
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") throw new MarketingBotValidationError("expected a string");
  return value;
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new MarketingBotValidationError("expected an array of strings");
  return value.map((item) => {
    if (typeof item !== "string") throw new MarketingBotValidationError("expected an array of strings");
    return item;
  });
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new MarketingBotValidationError("expected a number");
  }
  return value;
}

function parseSelectedAgendaInput(body: Record<string, unknown>) {
  const title = asOptionalString(body.title);
  const summary = asOptionalString(body.summary);
  if (!title || !summary) return undefined;
  return {
    title,
    summary,
    rationale: asOptionalStringArray(body.rationale),
    researchBriefId: asOptionalString(body.researchBriefId),
    agendaCandidateId: asOptionalString(body.agendaCandidateId),
    destinations: asOptionalStringArray(body.destinations),
    topics: asOptionalStringArray(body.topics),
    entities: asOptionalStringArray(body.entities),
    contentObjective: asOptionalString(body.contentObjective),
    audienceHint: asOptionalString(body.audienceHint),
    commercialIntent: asOptionalString(body.commercialIntent) as
      | import("@/lib/marketing/content/types").CommercialIntent
      | undefined,
    matchedProductIds: asOptionalStringArray(body.matchedProductIds),
    constraints: asOptionalStringArray(body.constraints),
    urgency: asOptionalString(body.urgency) as "low" | "normal" | "high" | undefined,
    timelinessNote: asOptionalString(body.timelinessNote),
    researchScoreAtSelection: asOptionalNumber(body.researchScoreAtSelection),
    idempotencyKey: asOptionalString(body.idempotencyKey),
  };
}

export function isMarketingBotToolName(value: string): value is MarketingBotToolName {
  return (MARKETING_BOT_TOOL_NAMES as readonly string[]).includes(value);
}

export async function dispatchMarketingBotTool(
  name: string,
  args: unknown,
  deps: MarketingBotDeps = {},
): Promise<unknown> {
  if (!isMarketingBotToolName(name)) {
    throw new MarketingBotValidationError(`Unknown tool: ${name}`);
  }
  const body = asRecord(args);
  switch (name) {
    case "get_marketing_context":
      return getMarketingContextTool(
        {
          purpose: asOptionalString(body.purpose) ?? "",
          productId: asOptionalString(body.productId),
          campaignId: asOptionalString(body.campaignId),
          channel: asOptionalString(body.channel),
          lookbackDays: asOptionalNumber(body.lookbackDays),
        },
        deps,
      );
    case "search_marketing_memory":
      return searchMarketingMemoryTool(
        {
          query: asOptionalString(body.query) ?? "",
          limit: asOptionalNumber(body.limit),
          memoryType: asOptionalString(body.memoryType),
          sourceType: asOptionalString(body.sourceType),
        },
        deps,
      );
    case "build_content_brief":
      return buildContentBriefTool(
        {
          productId: asOptionalString(body.productId) ?? "",
          channel: asOptionalString(body.channel) ?? "",
          campaignId: asOptionalString(body.campaignId),
          agendaId: asOptionalString(body.agendaId),
          purpose: asOptionalString(body.purpose),
          goal: asOptionalString(body.goal),
        },
        deps,
      );
    case "evaluate_governance":
      return evaluateGovernanceTool(
        {
          title: asOptionalString(body.title),
          body: asOptionalString(body.body) ?? "",
          channel: asOptionalString(body.channel) ?? "",
          productId: asOptionalString(body.productId),
          campaignId: asOptionalString(body.campaignId),
          agendaId: asOptionalString(body.agendaId),
          agendaKey: asOptionalString(body.agendaKey),
        },
        deps,
      );
    case "prepare_marketing_task":
      return prepareMarketingTask(
        {
          productId: asOptionalString(body.productId) ?? "",
          channel: asOptionalString(body.channel) ?? "",
          campaignId: asOptionalString(body.campaignId),
          agendaId: asOptionalString(body.agendaId),
          goal: asOptionalString(body.goal),
        },
        deps,
      );
    case "review_generated_content":
      return reviewGeneratedContent(
        {
          title: asOptionalString(body.title),
          body: asOptionalString(body.body) ?? "",
          channel: asOptionalString(body.channel) ?? "",
          productId: asOptionalString(body.productId),
          campaignId: asOptionalString(body.campaignId),
          agendaId: asOptionalString(body.agendaId),
          agendaKey: asOptionalString(body.agendaKey),
        },
        deps,
      );
    case "get_performance_evidence":
      return getPerformanceEvidenceTool(
        {
          productId: asOptionalString(body.productId),
          channel: asOptionalString(body.channel),
        },
        deps,
      );
    case "get_research_context":
      return getResearchContextTool(
        {
          limit: asOptionalNumber(body.limit),
          lookbackHours: asOptionalNumber(body.lookbackHours),
          topic: asOptionalString(body.topic),
          destination: asOptionalString(body.destination),
        },
        deps,
      );
    case "create_content_assignment": {
      const selectedAgenda = parseSelectedAgendaInput(body);
      if (!selectedAgenda) {
        throw new MarketingBotValidationError("create_content_assignment requires title and summary");
      }
      return createContentAssignmentTool(
        {
          ...selectedAgenda,
          channel: asOptionalString(body.channel),
        },
        deps,
      );
    }
    case "get_content_assignment":
      return getContentAssignmentTool(
        {
          assignmentId: asOptionalString(body.assignmentId) ?? "",
        },
        deps,
      );
    case "get_assignment_research_evidence":
      return getAssignmentResearchEvidenceTool(
        {
          assignmentId: asOptionalString(body.assignmentId) ?? "",
        },
        deps,
      );
    case "run_department_orchestration":
      return runDepartmentOrchestrationTool(
        {
          userRequest: asOptionalString(body.userRequest) ?? "",
          productId: asOptionalString(body.productId),
          channel: asOptionalString(body.channel),
          selectedAgenda: parseSelectedAgendaInput(body),
        },
        deps,
      );
    default: {
      const exhaustive: never = name;
      throw new MarketingBotValidationError(`Unhandled tool: ${exhaustive}`);
    }
  }
}
