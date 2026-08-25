import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { MarketingBotAuthError } from "@/lib/marketing/bot/errors";

export function readInternalMarketingToken(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return env[MARKETING_BOT_INTERNAL_TOKEN_ENV]?.trim() ?? "";
}

export function assertInternalMarketingAuth(
  authorization: string | null | undefined,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  const token = readInternalMarketingToken(env);
  if (!token) {
    throw new MarketingBotAuthError(`${MARKETING_BOT_INTERNAL_TOKEN_ENV} is not configured`);
  }
  const header = authorization?.trim() ?? "";
  if (header !== `Bearer ${token}`) {
    throw new MarketingBotAuthError();
  }
}
