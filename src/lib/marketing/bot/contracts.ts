export const MARKETING_BOT_ROLES = ["marketing_manager", "content", "governance"] as const;

export type MarketingBotRole = (typeof MARKETING_BOT_ROLES)[number];

export const MARKETING_BOT_CONTRACT_FILES = {
  marketing_manager: "src/lib/marketing/bot/contracts/marketing-manager.md",
  content: "src/lib/marketing/bot/contracts/content-bot.md",
  content_strategist: "src/lib/marketing/bot/contracts/content-strategist.md",
  governance: "src/lib/marketing/bot/contracts/governance-bot.md",
  governance_auditor: "src/lib/marketing/bot/contracts/governance-auditor.md",
  performance_analyst: "src/lib/marketing/bot/contracts/performance-analyst.md",
} as const;

export const MARKETING_AGENT_CONTRACT_FILES = {
  marketing_manager: MARKETING_BOT_CONTRACT_FILES.marketing_manager,
  content_strategist: MARKETING_BOT_CONTRACT_FILES.content_strategist,
  governance_auditor: MARKETING_BOT_CONTRACT_FILES.governance_auditor,
  performance_analyst: MARKETING_BOT_CONTRACT_FILES.performance_analyst,
} as const;
