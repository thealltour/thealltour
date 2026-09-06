import { createHash } from "node:crypto";

import {
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
  type AgendaCandidateEmbeddingTextInput,
  type CompletedMarketingCandidateEmbeddingTextInput,
  type ResearchBriefEmbeddingTextInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLine(label: string, value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = collapseWhitespace(String(value));
  if (!cleaned) return null;
  return `${label}:${cleaned}`;
}

function normalizeList(label: string, values: string[] | undefined, limit = 12): string | null {
  if (!values || values.length === 0) return null;
  const cleaned = [
    ...new Set(
      values
        .map((value) => collapseWhitespace(value).toLowerCase())
        .filter(Boolean),
    ),
  ]
    .sort()
    .slice(0, limit);
  if (cleaned.length === 0) return null;
  return `${label}:${cleaned.join(",")}`;
}

function joinCanonical(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
}

/**
 * Deterministic research_brief embedding text.
 * Excludes ids, timestamps, status, raw evidence blobs/URLs.
 */
export function buildResearchBriefCanonicalText(input: ResearchBriefEmbeddingTextInput): string {
  return joinCanonical([
    normalizeLine("title", input.title),
    normalizeLine("summary", input.summary),
    normalizeList("dest", input.destinations),
    normalizeList("topics", input.topics),
    normalizeList("claims", input.claims, 8),
    normalizeList("practical", input.practicalImplications, 6),
  ]);
}

/**
 * Deterministic agenda_candidate embedding text.
 * Uses editorial/why-now fields when present; excludes scores/ids/evidence IDs.
 */
export function buildAgendaCandidateCanonicalText(input: AgendaCandidateEmbeddingTextInput): string {
  return joinCanonical([
    normalizeLine("title", input.title),
    normalizeLine("summary", input.summary),
    normalizeLine("whyNow", input.whyNow),
    normalizeLine("koreanTravelerRelevance", input.koreanTravelerRelevance),
    normalizeLine("practicalValue", input.practicalValue),
    normalizeLine("theAllTourRelevance", input.theAllTourRelevance),
    normalizeList("dest", input.destinations),
    normalizeList("topics", input.topics),
  ]);
}

/**
 * Deterministic completed_marketing_candidate embedding text.
 * Uses draft body + light topic/channel context; excludes governance status and evidence IDs.
 */
export function buildCompletedMarketingCandidateCanonicalText(
  input: CompletedMarketingCandidateEmbeddingTextInput,
): string {
  const body = collapseWhitespace(input.body).slice(0, 4000);
  return joinCanonical([
    normalizeLine("title", input.title),
    normalizeLine("topic", input.topic),
    normalizeLine("channel", input.channel),
    normalizeLine("contentType", input.contentType),
    normalizeLine("body", body),
    normalizeList("claims", input.keyClaims, 8),
  ]);
}

/** SHA-256 hex over source_text_version identity + canonical text. */
export function hashMarketingSemanticSourceText(
  canonicalText: string,
  sourceTextVersion: string = MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
): string {
  const payload = `source_text_version=${sourceTextVersion}\n${canonicalText}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildResearchBriefContentHash(input: ResearchBriefEmbeddingTextInput): {
  canonicalText: string;
  contentHash: string;
  sourceTextVersion: typeof MARKETING_SEMANTIC_SOURCE_TEXT_VERSION;
} {
  const canonicalText = buildResearchBriefCanonicalText(input);
  return {
    canonicalText,
    contentHash: hashMarketingSemanticSourceText(canonicalText),
    sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
  };
}

export function buildAgendaCandidateContentHash(input: AgendaCandidateEmbeddingTextInput): {
  canonicalText: string;
  contentHash: string;
  sourceTextVersion: typeof MARKETING_SEMANTIC_SOURCE_TEXT_VERSION;
} {
  const canonicalText = buildAgendaCandidateCanonicalText(input);
  return {
    canonicalText,
    contentHash: hashMarketingSemanticSourceText(canonicalText),
    sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
  };
}

export function buildCompletedMarketingCandidateContentHash(
  input: CompletedMarketingCandidateEmbeddingTextInput,
): {
  canonicalText: string;
  contentHash: string;
  sourceTextVersion: typeof MARKETING_SEMANTIC_SOURCE_TEXT_VERSION;
} {
  const canonicalText = buildCompletedMarketingCandidateCanonicalText(input);
  return {
    canonicalText,
    contentHash: hashMarketingSemanticSourceText(canonicalText),
    sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
  };
}
