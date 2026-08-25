import type { MarketingBotToolName } from "@/lib/marketing/bot/types";
import { MARKETING_BOT_TOOL_NAMES } from "@/lib/marketing/bot/types";
import type { MarketingAgentRole, MarketingToolPermission } from "@/lib/marketing/bot/organization/types";

export const MARKETING_SKILL_MATRIX: Record<MarketingAgentRole, Record<MarketingBotToolName, MarketingToolPermission>> =
  {
    marketing_manager: {
      get_marketing_context: "allow",
      search_marketing_memory: "allow",
      build_content_brief: "allow",
      evaluate_governance: "optional",
      prepare_marketing_task: "allow",
      review_generated_content: "allow",
      get_performance_evidence: "allow",
    },
    content_strategist: {
      get_marketing_context: "allow",
      search_marketing_memory: "allow",
      build_content_brief: "allow",
      evaluate_governance: "optional",
      prepare_marketing_task: "deny",
      review_generated_content: "deny",
      get_performance_evidence: "deny",
    },
    governance_auditor: {
      get_marketing_context: "optional",
      search_marketing_memory: "allow",
      build_content_brief: "deny",
      evaluate_governance: "allow",
      prepare_marketing_task: "deny",
      review_generated_content: "allow",
      get_performance_evidence: "deny",
    },
    performance_analyst: {
      get_marketing_context: "allow",
      search_marketing_memory: "allow",
      build_content_brief: "deny",
      evaluate_governance: "deny",
      prepare_marketing_task: "deny",
      review_generated_content: "deny",
      get_performance_evidence: "allow",
    },
  };

export function allowedToolsForRole(role: MarketingAgentRole): MarketingBotToolName[] {
  return MARKETING_BOT_TOOL_NAMES.filter((tool) => MARKETING_SKILL_MATRIX[role][tool] === "allow");
}

export function isToolAllowedForRole(role: MarketingAgentRole, tool: MarketingBotToolName): boolean {
  const permission = MARKETING_SKILL_MATRIX[role][tool];
  return permission === "allow" || permission === "optional";
}
