export { MARKETING_AGENT_ROLES, DEPARTMENT_POLICY_PATH } from "@/lib/marketing/bot/organization/types";
export type {
  AgentRoleConfig,
  MarketingAgentHandoffTarget,
  MarketingAgentRole,
  MarketingForbiddenAction,
  MarketingToolPermission,
} from "@/lib/marketing/bot/organization/types";
export { MARKETING_AGENT_ROLE_CONFIGS, marketingAgentRoleConfig } from "@/lib/marketing/bot/organization/roles";
export {
  MARKETING_SKILL_MATRIX,
  allowedToolsForRole,
  isToolAllowedForRole,
} from "@/lib/marketing/bot/organization/skillMatrix";
export { DEPARTMENT_COMMON_RULES, DEPARTMENT_FORBIDDEN_ACTIONS } from "@/lib/marketing/bot/organization/policies";
export type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewRequest,
  GovernanceReviewResult,
  MarketingManagerOutput,
  PerformanceAnalystOutput,
  PerformanceBrief,
} from "@/lib/marketing/bot/organization/handoffs";
