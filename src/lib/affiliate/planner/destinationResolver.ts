import type { AffiliateDestination } from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";

/**
 * Provider-neutral destination resolution for Affiliate routing.
 * No network calls. No LLM/ad-hoc city→country tables.
 * Only propagates ISO 3166-1 alpha-2 when already present as a 2-letter code.
 */
export async function resolveAffiliateDestination(params: {
  destinationText: string;
  plan: PlannerPlan;
  input: PlannerDraftInput | null;
}): Promise<AffiliateDestination> {
  const text =
    params.destinationText.trim() ||
    params.input?.destination.text?.trim() ||
    params.plan.destination.name.trim() ||
    "";

  const countryCode = extractIsoCountryCode({
    planCountry: params.plan.destination.country,
  });

  return {
    text,
    countryCode,
    cityCode: null,
    iataCityCode: null,
    iataAirportCodes: undefined,
  };
}

/** Accept only explicit ISO alpha-2; reject display names like "일본". */
export function extractIsoCountryCode(params: {
  planCountry?: string | null;
}): string | null {
  const raw = params.planCountry?.trim() ?? "";
  if (/^[A-Za-z]{2}$/.test(raw)) {
    return raw.toUpperCase();
  }
  return null;
}
