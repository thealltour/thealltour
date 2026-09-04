import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import { resolveAgendaSlateTargetSize } from "@/lib/marketing/cron/daily/agendaSlate/config";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";

export type ManagerSlateCurationItem = {
  agendaCandidateId: string | null;
  researchBriefId: string | null;
  title: string;
  summary: string;
  rationale: string[];
  freshnessWhyNow: string | null;
  koreanTravelerRelevance: string | null;
  practicalTravelValue: string | null;
  theAllTourBusinessRelevance: string | null;
  contentPotential: string | null;
  recommendedFormats: string[];
  recommendedChannel: string | null;
};

export type ManagerSlateCurationResult =
  | {
      outcome: "curated";
      items: ManagerSlateCurationItem[];
      managerMessage: string | null;
    }
  | { outcome: "defer_all"; message: string }
  | { outcome: "invalid"; message: string };

export function buildManagerAgendaSlateCurationPrompt(
  context: MarketingResearchContext,
  targetSize = 6,
): string {
  const size = resolveAgendaSlateTargetSize(targetSize);
  return [
    "JSON only. You are Marketing Manager CURATING a human-reviewable agenda SLATE.",
    `Select ${size} distinct research-backed agenda candidates (allowed range 5-8).`,
    "Do NOT pick only #1 by score. Do NOT draft content. Do NOT call Content Strategist.",
    "Evaluate: freshness/why-now, Korean traveler relevance, practical travel value,",
    "TheAllTour/business relevance, content potential, recommended channel/format.",
    "Each item needs a concise human-readable rationale (1-3 bullets).",
    "Productless high-value travel topics are valid.",
    JSON.stringify({
      status: context.status,
      targetSize: size,
      agendaCandidates: context.agendaCandidates.slice(0, 12),
      briefs: context.briefs.slice(0, 12),
      notes: context.notes,
    }),
    'shape: {"decision":"curate|defer_all","items":[{"agendaCandidateId":null,"researchBriefId":null,"title":"","summary":"","rationale":[],"freshnessWhyNow":"","koreanTravelerRelevance":"","practicalTravelValue":"","theAllTourBusinessRelevance":"","contentPotential":"","recommendedFormats":["threads_text"],"recommendedChannel":"threads"}],"managerMessage":null,"deferReason":null}',
  ].join("\n");
}

function asStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((s) => s.trim()).filter(Boolean).slice(0, limit);
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function parseManagerAgendaSlateCuration(
  raw: string,
  context: MarketingResearchContext,
  targetSize = 6,
): ManagerSlateCurationResult {
  let value: Record<string, unknown>;
  try {
    value = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    return { outcome: "invalid", message: "manager_slate_json_parse_failed" };
  }

  const decision = String(value.decision ?? "curate").toLowerCase();
  if (decision === "defer_all" || decision === "defer") {
    return {
      outcome: "defer_all",
      message: String(value.deferReason ?? value.managerMessage ?? "manager_deferred_slate"),
    };
  }

  const size = resolveAgendaSlateTargetSize(targetSize);
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items: ManagerSlateCurationItem[] = [];
  const seen = new Set<string>();

  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const title = String(record.title ?? "").trim();
    const summary = String(record.summary ?? "").trim();
    if (!title || !summary) continue;

    const agendaCandidateId = record.agendaCandidateId ? String(record.agendaCandidateId) : null;
    const researchBriefId = record.researchBriefId ? String(record.researchBriefId) : null;
    const identityKey = agendaCandidateId ?? researchBriefId ?? title.toLowerCase();
    if (seen.has(identityKey)) continue;
    seen.add(identityKey);

    // Prefer known research identities when provided.
    const known =
      (agendaCandidateId &&
        context.agendaCandidates.find((c) => c.agendaCandidateId === agendaCandidateId)) ||
      (researchBriefId &&
        context.agendaCandidates.find((c) => c.researchBriefId === researchBriefId)) ||
      null;

    items.push({
      agendaCandidateId: known?.agendaCandidateId ?? agendaCandidateId,
      researchBriefId: known?.researchBriefId ?? researchBriefId ?? known?.researchBriefId ?? null,
      title: known?.title ?? title,
      summary: known?.summary ?? summary,
      rationale: asStringArray(record.rationale, 6),
      freshnessWhyNow: asOptionalString(record.freshnessWhyNow),
      koreanTravelerRelevance: asOptionalString(record.koreanTravelerRelevance),
      practicalTravelValue: asOptionalString(record.practicalTravelValue),
      theAllTourBusinessRelevance: asOptionalString(record.theAllTourBusinessRelevance),
      contentPotential: asOptionalString(record.contentPotential),
      recommendedFormats: asStringArray(record.recommendedFormats, 4),
      recommendedChannel: asOptionalString(record.recommendedChannel) ?? "threads",
    });
    if (items.length >= size) break;
  }

  if (items.length < 5) {
    return { outcome: "invalid", message: `manager_slate_too_small:${items.length}` };
  }

  return {
    outcome: "curated",
    items: items.slice(0, size),
    managerMessage: asOptionalString(value.managerMessage),
  };
}
