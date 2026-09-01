import "server-only";

import { evaluateGovernanceTool, reviewGeneratedContent } from "@/lib/marketing/bot/evaluateGovernanceTool";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { getMarketingContextTool } from "@/lib/marketing/bot/getMarketingContextTool";
import { buildContentBriefTool, prepareMarketingTask } from "@/lib/marketing/bot/prepareMarketingTask";
import { getPerformanceEvidenceTool } from "@/lib/marketing/bot/getPerformanceEvidenceTool";
import { getResearchContextTool } from "@/lib/marketing/bot/getResearchContextTool";
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

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new MarketingBotValidationError("expected a number");
  }
  return value;
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
    case "run_department_orchestration":
      return runDepartmentOrchestrationTool(
        {
          userRequest: asOptionalString(body.userRequest) ?? "",
          productId: asOptionalString(body.productId),
          channel: asOptionalString(body.channel),
        },
        deps,
      );
    default: {
      const exhaustive: never = name;
      throw new MarketingBotValidationError(`Unhandled tool: ${exhaustive}`);
    }
  }
}
