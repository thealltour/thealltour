import "server-only";

import { parseMarketingContextRequest, requireUuid } from "@/lib/marketing/context/validation";
import { compactMarketingContext } from "@/lib/marketing/bot/compactContext";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import type { GetMarketingContextInput, GetMarketingContextResult, MarketingBotDeps } from "@/lib/marketing/bot/types";

export async function getMarketingContextTool(
  input: GetMarketingContextInput,
  deps: MarketingBotDeps = {},
): Promise<GetMarketingContextResult> {
  if (!input.purpose?.trim()) {
    throw new MarketingBotValidationError("purpose is required");
  }
  const parsed = parseMarketingContextRequest({
    purpose: input.purpose,
    productId: input.productId ?? undefined,
    campaignId: input.campaignId ?? undefined,
    channel: input.channel ?? undefined,
    lookbackDays: input.lookbackDays,
  });
  const compose =
    deps.composeContext ??
    (await import("@/lib/marketing/context/contextService")).composeMarketingContext;
  const pkg = await compose(parsed);
  return {
    productFound: Boolean(parsed.productId && pkg.context.product),
    context: compactMarketingContext(pkg),
    generatedAt: pkg.generatedAt,
  };
}

export function requireProductId(productId: string | null | undefined): string {
  if (!productId?.trim()) throw new MarketingBotValidationError("productId is required");
  return requireUuid(productId, "productId");
}
