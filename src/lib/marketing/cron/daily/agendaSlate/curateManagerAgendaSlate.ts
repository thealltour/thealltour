import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import { resolveAgendaSlateTargetSize } from "@/lib/marketing/cron/daily/agendaSlate/config";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerEvidenceRef,
  MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";
import type { ResearchScoreComponents } from "@/lib/marketing/research/services/scoringPolicy";

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

const SUMMARY_CHAR_LIMIT = 320;
const EXCERPT_CHAR_LIMIT = 280;
const MAX_CANDIDATES_IN_PROMPT = 12;

export type CompactCurationEvidence = {
  evidenceId: string;
  sourceName: string | null;
  sourceType: string | null;
  isOfficial: boolean;
  url: string | null;
  excerpt: string | null;
};

export type CompactCurationCandidate = {
  agendaCandidateId: string;
  researchBriefId: string;
  title: string;
  summary: string;
  destinations: string[];
  topics: string[];
  signalTypes: string[];
  totalResearchScore: number;
  freshnessScore: number;
  credibilityScore: number;
  travelRelevanceScore: number;
  publicInterestScore: number;
  commercialRelevanceScore: number;
  researchScoreComponents: ResearchScoreComponents | null;
  scoreReasons: string[];
  riskFlags: string[];
  matchedProductIds: string[];
  representativeEvidence: CompactCurationEvidence | null;
};

export type CompactManagerSlateCurationPayload = {
  status: MarketingResearchContext["status"];
  targetSize: number;
  candidateCount: number;
  /** Full duplicate briefs omitted — identity + judgment fields live on agendaCandidates. */
  briefsOmitted: true;
  notes: string[];
  agendaCandidates: CompactCurationCandidate[];
};

function clipText(value: string | null | undefined, limit: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function evidenceDedupeKey(ref: CompactManagerEvidenceRef): string {
  const url = (ref.url ?? "").trim().toLowerCase();
  if (url) return `url:${url}`;
  const excerpt = (ref.excerpt ?? "").trim().toLowerCase().slice(0, 160);
  if (excerpt) return `excerpt:${excerpt}`;
  return `id:${ref.evidenceId}`;
}

/** Prefer one official (or first unique) evidence row; drop identical article duplicates. */
export function pickRepresentativeEvidence(
  evidence: CompactManagerEvidenceRef[] | null | undefined,
): CompactCurationEvidence | null {
  if (!evidence?.length) return null;
  const unique: CompactManagerEvidenceRef[] = [];
  const seen = new Set<string>();
  for (const ref of evidence) {
    const key = evidenceDedupeKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  const chosen =
    unique.find((ref) => ref.isOfficial) ??
    unique.find((ref) => (ref.url ?? "").trim() || (ref.excerpt ?? "").trim()) ??
    unique[0] ??
    null;
  if (!chosen) return null;
  return {
    evidenceId: chosen.evidenceId,
    sourceName: chosen.sourceName,
    sourceType: chosen.sourceType,
    isOfficial: chosen.isOfficial,
    url: chosen.url,
    excerpt: clipText(chosen.excerpt, EXCERPT_CHAR_LIMIT),
  };
}

export function compactAgendaCandidateForCuration(
  candidate: CompactManagerAgendaCandidate,
): CompactCurationCandidate {
  return {
    agendaCandidateId: candidate.agendaCandidateId,
    researchBriefId: candidate.researchBriefId,
    title: candidate.title,
    summary: clipText(candidate.summary, SUMMARY_CHAR_LIMIT) ?? "",
    destinations: (candidate.destinations ?? []).slice(0, 6),
    topics: (candidate.topics ?? []).slice(0, 8),
    signalTypes: (candidate.signalTypes ?? []).slice(0, 6),
    totalResearchScore: candidate.totalResearchScore,
    freshnessScore: candidate.freshnessScore,
    credibilityScore: candidate.credibilityScore,
    travelRelevanceScore: candidate.travelRelevanceScore,
    publicInterestScore: candidate.publicInterestScore,
    commercialRelevanceScore: candidate.commercialRelevanceScore,
    researchScoreComponents: candidate.researchScoreComponents,
    scoreReasons: (candidate.scoreReasons ?? []).slice(0, 4),
    riskFlags: (candidate.riskFlags ?? []).slice(0, 6),
    matchedProductIds: (candidate.matchedProductIds ?? []).slice(0, 6),
    representativeEvidence: pickRepresentativeEvidence(candidate.evidence),
  };
}

export function buildCompactManagerSlateCurationPayload(
  context: MarketingResearchContext,
  targetSize = 6,
): CompactManagerSlateCurationPayload {
  const size = resolveAgendaSlateTargetSize(targetSize);
  const sliced = context.agendaCandidates.slice(0, MAX_CANDIDATES_IN_PROMPT);
  return {
    status: context.status,
    targetSize: size,
    candidateCount: context.agendaCandidates.length,
    briefsOmitted: true,
    notes: (context.notes ?? []).slice(0, 8).map((n) => clipText(n, 200) ?? "").filter(Boolean),
    agendaCandidates: sliced.map(compactAgendaCandidateForCuration),
  };
}

/** Legacy full research dump — retained only for size comparison / regression measurement. */
export function buildLegacyManagerAgendaSlateCurationPrompt(
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

export function measureManagerSlateCurationPromptBytes(
  context: MarketingResearchContext,
  targetSize = 6,
): { legacyBytes: number; compactBytes: number; candidateCount: number } {
  const legacy = buildLegacyManagerAgendaSlateCurationPrompt(context, targetSize);
  const compact = buildManagerAgendaSlateCurationPrompt(context, targetSize);
  return {
    legacyBytes: Buffer.byteLength(legacy, "utf8"),
    compactBytes: Buffer.byteLength(compact, "utf8"),
    candidateCount: context.agendaCandidates.length,
  };
}

export function buildManagerAgendaSlateCurationPrompt(
  context: MarketingResearchContext,
  targetSize = 6,
): string {
  const size = resolveAgendaSlateTargetSize(targetSize);
  const payload = buildCompactManagerSlateCurationPayload(context, size);
  return [
    "JSON only. You are Marketing Manager CURATING a human-reviewable agenda SLATE.",
    `Select ${size} distinct research-backed agenda candidates (allowed range 5-8).`,
    "Do NOT pick only #1 by score. Do NOT draft content. Do NOT call Content Strategist.",
    "Evaluate: freshness/why-now, Korean traveler relevance, practical travel value,",
    "TheAllTour/business relevance, content potential, recommended channel/format.",
    "Each item needs a concise human-readable rationale (1-3 bullets).",
    "Productless high-value travel topics are valid.",
    "Input is compact curation candidates only (full briefs omitted; one evidence excerpt each).",
    JSON.stringify(payload),
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
