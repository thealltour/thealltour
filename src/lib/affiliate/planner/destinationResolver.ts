import { resolveAffiliateCountryCode } from "@/lib/affiliate/planner/countryIdentity";
import type { AffiliateDestination } from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";

/**
 * Provider-neutral destination resolution for Affiliate routing.
 * No network calls. No LLM/ad-hoc city→country tables.
 * countryCode is derived for routing only; plan.destination.country stays as displayed.
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
    destinationText: text,
  });

  return {
    text,
    countryCode,
    cityCode: null,
    iataCityCode: null,
    iataAirportCodes: undefined,
  };
}

/**
 * Plan country (ISO alpha-2, Korean or English country name) → ISO alpha-2.
 * Falls back to the destination text only when it is itself a country name (e.g. "일본");
 * 2-letter destination text is never read as ISO ("LA" is a city, not Laos).
 */
export function extractIsoCountryCode(params: {
  planCountry?: string | null;
  destinationText?: string | null;
}): string | null {
  const fromPlan = resolveAffiliateCountryCode(params.planCountry);
  if (fromPlan) return fromPlan;
  const text = params.destinationText?.trim() ?? "";
  if (!text || /^[A-Za-z]{2}$/.test(text)) return null;
  return resolveAffiliateCountryCode(text);
}
