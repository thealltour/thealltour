/**
 * STEP E-4F: Content/event vs context/bias corroboration.
 * Exact URL/title identity is deterministic (cooldown/title dedupe) — not semantic demotion.
 */
import { normalizeSourceArticleIdentity } from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { curationSourceKey } from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import {
  SEMANTIC_DATE_PROXIMITY_DAYS,
  SEMANTIC_TITLE_TOKEN_OVERLAP_STRONG,
  SEMANTIC_TITLE_TOKEN_OVERLAP_WEAK,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/constants";
import type {
  SemanticContentCorroborator,
  SemanticContextSignal,
  SemanticDeterministicExactSignal,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/types";

/** Matches getMarketingManagerResearchContext title exact-dedupe key. */
export function normalizeAgendaTitleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\uac00-\ud7a3]+/g, " ")
    .trim()
    .slice(0, 96);
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\uac00-\ud7a3\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
}

export function titleTokenJaccard(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

function seriesHint(title: string): string | null {
  const bracket = title.match(/\[([^\]]+)\]/);
  if (bracket?.[1]) {
    const cleaned = bracket[1]
      .replace(/[①②③④⑤⑥⑦⑧⑨⑩\d]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (cleaned.length >= 4) return cleaned;
  }
  const m =
    title.match(/([가-힣A-Za-z0-9\s]{2,24})\s*[①②③④⑤⑥⑦⑧⑨⑩]/) ||
    title.match(/(시리즈|이야기|part|episode)\s*[#:]?\s*\d+/i);
  if (!m) return null;
  return (m[1] || m[0]).trim().toLowerCase();
}

/** Strip series/template markers so shared series vocabulary is not content corroboration. */
export function stripSeriesTemplateForContentOverlap(title: string): string {
  return title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/(시리즈|이야기|part|episode)\s*[#:]?\s*\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryCanonicalUrl(candidate: CompactManagerAgendaCandidate): string | null {
  for (const ev of candidate.evidence ?? []) {
    const key = normalizeSourceArticleIdentity({
      url: ev.url,
      sourceId: ev.sourceId,
      evidenceId: ev.evidenceId,
    });
    if (key?.startsWith("http")) return key;
  }
  return null;
}

function primarySourceKey(candidate: CompactManagerAgendaCandidate): string {
  const first = candidate.evidence?.[0];
  return curationSourceKey({
    sourceName: first?.sourceName,
    sourceId: first?.sourceId,
  });
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.abs(ta - tb) / (24 * 60 * 60 * 1000);
}

function normalizedSet(values: string[] | null | undefined): Set<string> {
  return new Set(
    (values ?? [])
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 1 && !/^\d+$/.test(v)),
  );
}

function setsIntersect(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

export type CorroborationBreakdown = {
  /** Exact identity — handled by cooldown/title dedupe, never semantic demotion. */
  deterministicExactSignals: SemanticDeterministicExactSignal[];
  /** Content/event signals that can gate a semantic soft penalty. */
  contentCorroborators: SemanticContentCorroborator[];
  /** Bias/context diagnostics — never sufficient alone for demotion. */
  contextSignals: SemanticContextSignal[];
  titleJaccard: number;
  /** True when at least one content/event corroborator qualifies. */
  hasContentCorroboration: boolean;
  /** Strong content corroboration (high title overlap or dest+topic+date). */
  hasStrongContentCorroboration: boolean;
};

/**
 * Classify pair signals into exact / content / context buckets.
 * Destination alone, date alone, source family, series/template => context only.
 */
export function computeCorroborationSignals(
  a: CompactManagerAgendaCandidate,
  b: CompactManagerAgendaCandidate,
): CorroborationBreakdown {
  const deterministicExactSignals: SemanticDeterministicExactSignal[] = [];
  const contentCorroborators: SemanticContentCorroborator[] = [];
  const contextSignals: SemanticContextSignal[] = [];

  const urlA = primaryCanonicalUrl(a);
  const urlB = primaryCanonicalUrl(b);
  if (urlA && urlB && urlA === urlB) {
    deterministicExactSignals.push("canonical_url_match");
  }

  const titleA = normalizeAgendaTitleFingerprint(a.title ?? "");
  const titleB = normalizeAgendaTitleFingerprint(b.title ?? "");
  if (titleA && titleB && titleA === titleB) {
    deterministicExactSignals.push("normalized_title_match");
  }

  // Content title overlap ignores series/template markers (①/brackets) so same-series
  // vocabulary alone cannot gate a semantic penalty.
  const jaccard = titleTokenJaccard(
    stripSeriesTemplateForContentOverlap(a.title ?? ""),
    stripSeriesTemplateForContentOverlap(b.title ?? ""),
  );
  // Meaningful partial overlap only — exact title match is deterministic, not semantic.
  if (
    deterministicExactSignals.includes("normalized_title_match") === false &&
    jaccard >= SEMANTIC_TITLE_TOKEN_OVERLAP_WEAK
  ) {
    contentCorroborators.push("title_token_overlap");
  }

  const destA = normalizedSet(a.destinations);
  const destB = normalizedSet(b.destinations);
  const topicA = new Set([...normalizedSet(a.topics)].filter((t) => t !== "travel"));
  const topicB = new Set([...normalizedSet(b.topics)].filter((t) => t !== "travel"));
  const destOverlap = setsIntersect(destA, destB);
  const topicOverlap = setsIntersect(topicA, topicB);
  const dayGap = daysBetween(a.publishedAt ?? a.observedAt, b.publishedAt ?? b.observedAt);
  const closeDate = dayGap != null && dayGap <= SEMANTIC_DATE_PROXIMITY_DAYS;

  if (destOverlap && !topicOverlap) {
    contextSignals.push("destination_overlap_only");
  }
  if (topicOverlap && !destOverlap) {
    contextSignals.push("topic_overlap_only");
  }
  if (destOverlap && topicOverlap && !closeDate) {
    // Dest+topic without date is still ambient/category bias for semantic demotion.
    contextSignals.push("destination_and_topic_match");
  }
  if (destOverlap && topicOverlap && closeDate) {
    contentCorroborators.push("destination_topic_and_date");
  }
  if (closeDate && !(destOverlap && topicOverlap)) {
    contextSignals.push("date_proximity");
  }

  if (primarySourceKey(a) === primarySourceKey(b) && primarySourceKey(a) !== "source:unknown") {
    contextSignals.push("source_family_same");
  }

  const seriesA = seriesHint(a.title ?? "");
  const seriesB = seriesHint(b.title ?? "");
  if (seriesA && seriesB && seriesA === seriesB) {
    contextSignals.push("series_template_hint");
  }

  const hasStrongContentCorroboration =
    contentCorroborators.includes("destination_topic_and_date") ||
    (contentCorroborators.includes("title_token_overlap") &&
      jaccard >= SEMANTIC_TITLE_TOKEN_OVERLAP_STRONG);

  return {
    deterministicExactSignals,
    contentCorroborators,
    contextSignals,
    titleJaccard: jaccard,
    hasContentCorroboration: contentCorroborators.length > 0,
    hasStrongContentCorroboration,
  };
}

/** Destination-only overlap helper for tests / diagnostics. */
export function destinationsOverlapOnly(
  a: CompactManagerAgendaCandidate,
  b: CompactManagerAgendaCandidate,
): boolean {
  const destA = normalizedSet(a.destinations);
  const destB = normalizedSet(b.destinations);
  const topicA = new Set([...normalizedSet(a.topics)].filter((t) => t !== "travel"));
  const topicB = new Set([...normalizedSet(b.topics)].filter((t) => t !== "travel"));
  return setsIntersect(destA, destB) && !setsIntersect(topicA, topicB);
}
