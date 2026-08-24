import type { MarketingContextPackage, MarketingContextRequest } from "@/lib/marketing/context/types";
import { assembleFromRetrieval, executeRetrievalPlan } from "@/lib/marketing/retrieval/executeRetrievalPlan";
import { buildRetrievalPlan } from "@/lib/marketing/retrieval/planner";
import type { MarketingRetrievalRequest, RetrievalAdapters } from "@/lib/marketing/retrieval/types";
import {
  parseMarketingRetrievalRequest,
  withComposePeriodDefaults,
} from "@/lib/marketing/retrieval/validation";

export async function runMarketingRetrieval(
  request: MarketingRetrievalRequest | MarketingContextRequest,
  adapters: RetrievalAdapters,
  options?: { injectLookbackDefault?: boolean },
): Promise<MarketingContextPackage> {
  const prepared = options?.injectLookbackDefault === false ? request : withComposePeriodDefaults(request);
  const parsed = parseMarketingRetrievalRequest(prepared);
  const plan = buildRetrievalPlan(parsed);
  const retrieved = await executeRetrievalPlan(parsed, plan, adapters);
  return assembleFromRetrieval(
    {
      purpose: parsed.purpose,
      productId: parsed.productId,
      campaignId: parsed.campaignId,
      channel: parsed.channel,
      lookbackDays: parsed.lookbackDays,
      periodStart: parsed.period?.start ?? parsed.periodStart,
      periodEnd: parsed.period?.end ?? parsed.periodEnd,
    },
    retrieved,
  );
}
