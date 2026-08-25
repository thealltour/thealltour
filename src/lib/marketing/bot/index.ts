export type {
  BotRunTrace,
  BuildContentBriefInput,
  CompactGovernanceResult,
  CompactMarketingContext,
  CompactMemoryMatch,
  ContentBrief,
  EvaluateGovernanceInput,
  GetMarketingContextInput,
  GetMarketingContextResult,
  HumanApprovalHandoff,
  MarketingBotDeps,
  MarketingBotResult,
  MarketingBotResultStatus,
  MarketingBotToolName,
  PrepareMarketingTaskInput,
  PrepareMarketingTaskResult,
  ReviewGeneratedContentInput,
  SearchMarketingMemoryInput,
  SearchMarketingMemoryResult,
} from "@/lib/marketing/bot/types";
export { MARKETING_BOT_RESULT_STATUSES, MARKETING_BOT_TOOL_NAMES } from "@/lib/marketing/bot/types";
export { MARKETING_BOT_INTERNAL_TOKEN_ENV, MARKETING_BOT_VERSION } from "@/lib/marketing/bot/constants";
export { MarketingBotAuthError, MarketingBotValidationError } from "@/lib/marketing/bot/errors";
export { getMarketingContextTool } from "@/lib/marketing/bot/getMarketingContextTool";
export { searchMarketingMemoryTool } from "@/lib/marketing/bot/searchMarketingMemoryTool";
export { buildContentBriefTool, prepareMarketingTask } from "@/lib/marketing/bot/prepareMarketingTask";
export { evaluateGovernanceTool, reviewGeneratedContent } from "@/lib/marketing/bot/evaluateGovernanceTool";
export { dispatchMarketingBotTool } from "@/lib/marketing/bot/dispatch";
export { handleMarketingMcpJsonRpc, handleMarketingToolHttp } from "@/lib/marketing/bot/httpHandler";
export { parseMarketingBotCliArgs } from "@/lib/marketing/bot/cli";
export type { MarketingBotCliArgs } from "@/lib/marketing/bot/cli";
export { MARKETING_BOT_CONTRACT_FILES, MARKETING_BOT_ROLES, MARKETING_AGENT_CONTRACT_FILES } from "@/lib/marketing/bot/contracts";
export {
  MARKETING_AGENT_ROLES,
  MARKETING_AGENT_ROLE_CONFIGS,
  MARKETING_SKILL_MATRIX,
  allowedToolsForRole,
} from "@/lib/marketing/bot/organization";
export type { AgentRoleConfig, MarketingAgentRole } from "@/lib/marketing/bot/organization";
export { buildBotRunTrace } from "@/lib/marketing/bot/mapBotResult";
