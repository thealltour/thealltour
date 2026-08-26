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
export {
  AGENT_IDENTITY_ENFORCEMENT,
  MAX_AUTO_REVISION_ROUNDS,
  createHandoffEnvelope,
  parseHandoffEnvelope,
  serializeHandoffEnvelope,
} from "@/lib/marketing/bot/organization/envelope";
export { HERMES_HANDOFF_CLASSIFICATION, buildHermesOneshotArgv } from "@/lib/marketing/bot/organization/hermesHandoff";
export { applyPipelineApproval, runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
export { PROJECT_DEPARTMENT_REGISTRY, resolveDepartmentRegistry } from "@/lib/marketing/bot/organization/registry";
export { routeDepartmentRequest } from "@/lib/marketing/bot/organization/routing";
export { orchestrateDepartmentTask } from "@/lib/marketing/bot/organization/orchestrate";
export type { DepartmentOrchestrationResult } from "@/lib/marketing/bot/organization/orchestrate";
export type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewRequest,
  GovernanceReviewResult,
  MarketingManagerOutput,
  PerformanceAnalystOutput,
  PerformanceBrief,
} from "@/lib/marketing/bot/organization/handoffs";
