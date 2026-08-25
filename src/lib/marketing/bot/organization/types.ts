import type { MarketingBotToolName } from "@/lib/marketing/bot/types";

export const MARKETING_AGENT_ROLES = [
  "marketing_manager",
  "content_strategist",
  "governance_auditor",
  "performance_analyst",
] as const;

export type MarketingAgentRole = (typeof MARKETING_AGENT_ROLES)[number];

export const MARKETING_AGENT_HANDOFF_TARGETS = [
  "human_owner",
  "marketing_manager",
  "content_strategist",
  "governance_auditor",
  "performance_analyst",
] as const;

export type MarketingAgentHandoffTarget = (typeof MARKETING_AGENT_HANDOFF_TARGETS)[number];

export const MARKETING_TOOL_PERMISSIONS = ["allow", "optional", "deny"] as const;

export type MarketingToolPermission = (typeof MARKETING_TOOL_PERMISSIONS)[number];

export const MARKETING_FORBIDDEN_ACTIONS = [
  "publish",
  "send",
  "post",
  "delete",
  "archive",
  "auto_approve",
  "override_governance",
  "invent_product_facts",
  "use_raw_pii",
] as const;

export type MarketingForbiddenAction = (typeof MARKETING_FORBIDDEN_ACTIONS)[number];

export type AgentRoleConfig = {
  id: MarketingAgentRole;
  displayName: string;
  responsibilities: string[];
  allowedTools: MarketingBotToolName[];
  toolPermissions: Record<MarketingBotToolName, MarketingToolPermission>;
  forbiddenActions: MarketingForbiddenAction[];
  handoffTargets: MarketingAgentHandoffTarget[];
  autoPublishAllowed: false;
  departmentPolicy: "docs/hermes/marketing/department-policy.md";
  contractFile: string;
  promptFile: string;
};

export const DEPARTMENT_POLICY_PATH = "docs/hermes/marketing/department-policy.md" as const;
