import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";
import { parseAgendaFreshnessClass } from "@/lib/marketing/agendaQualityV2/freshness";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseMarketingAgendaTransformerOutput(
  raw: string,
): MarketingAgendaTransformerLlmOutput | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const freshness = parseAgendaFreshnessClass(o.freshnessClass) ?? "timely";

  return {
    targetTravelerKo: asString(o.targetTravelerKo),
    travelerProblemKo: asString(o.travelerProblemKo),
    decisionAtStakeKo: asString(o.decisionAtStakeKo),
    audienceTensionKo: asString(o.audienceTensionKo),
    readerPayoffKo: asString(o.readerPayoffKo),
    marketingStorySeedKo: asString(o.marketingStorySeedKo),
    whyNowKo: asString(o.whyNowKo),
    researchQuestionsKo: asStringArray(o.researchQuestionsKo),
    nonGoalsKo: asStringArray(o.nonGoalsKo),
    genericRiskKo: asString(o.genericRiskKo) || "unspecified",
    storyArchetypeHint: asString(o.storyArchetypeHint) || "other",
    freshnessClass: freshness,
    signalSummaryKo: asString(o.signalSummaryKo) || undefined,
    limitations: asStringArray(o.limitations),
  };
}
