import type { MarketingContextPackage, MarketingContextRequest } from "@/lib/marketing/context/types";
import { assembleFromRetrieval, executeRetrievalPlan } from "@/lib/marketing/retrieval/executeRetrievalPlan";
import { buildRetrievalPlan } from "@/lib/marketing/retrieval/planner";
import type { MarketingRetrievalRequest, RetrievalAdapters } from "@/lib/marketing/retrieval/types";
import {
  parseMarketingRetrievalRequest,
  withComposePeriodDefaults,
} from "@/lib/marketing/retrieval/validation";
import { selectScoredContext } from "@/lib/marketing/scoring/selectScoredContext";
import { resolveSemanticContextStatus } from "@/lib/marketing/semantic/semanticRetrieve";
import type { SemanticContextStatus } from "@/lib/marketing/semantic/types";

export async function runMarketingRetrieval(
  request: MarketingRetrievalRequest | MarketingContextRequest,
  adapters: RetrievalAdapters,
  options?: {
    injectLookbackDefault?: boolean;
    contextLimit?: number;
    now?: Date;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
): Promise<MarketingContextPackage> {
  const prepared = options?.injectLookbackDefault === false ? request : withComposePeriodDefaults(request);
  const parsed = parseMarketingRetrievalRequest(prepared);
  const plan = buildRetrievalPlan(parsed);
  const retrieved = await executeRetrievalPlan(parsed, plan, adapters);
  const scored = selectScoredContext(
    retrieved,
    {
      purpose: parsed.purpose,
      canonicalPurpose: parsed.canonicalPurpose,
      productId: parsed.productId,
      campaignId: parsed.campaignId,
      agendaId: parsed.agendaId,
      channel: parsed.channel,
    },
    { contextLimit: options?.contextLimit, now: options?.now },
  );
  const semantic = resolveSemanticStatusSafely(options?.env);
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
    scored.retrieval,
    {
      ranking: {
        candidateCount: scored.candidates.length,
        selectedCount: scored.selected.length,
        contextLimit: scored.contextLimit,
      },
      semantic,
    },
  );
}

function resolveSemanticStatusSafely(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): SemanticContextStatus {
  try {
    return resolveSemanticContextStatus(env);
  } catch {
    return { status: "failed", reason: "provider_error" };
  }
}
