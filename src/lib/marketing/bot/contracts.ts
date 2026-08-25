export const MARKETING_BOT_ROLES = ["marketing_manager", "content", "governance"] as const;

export type MarketingBotRole = (typeof MARKETING_BOT_ROLES)[number];

export const MARKETING_BOT_CONTRACT_FILES = {
  marketing_manager: "src/lib/marketing/bot/contracts/marketing-manager.md",
  content: "src/lib/marketing/bot/contracts/content-bot.md",
  governance: "src/lib/marketing/bot/contracts/governance-bot.md",
} as const;
