import type { ActivityDiscoveryMatchConfidence } from "@/lib/affiliate/planner/discovery/types";
import {
  activityNameTokens,
  containsTokenPhrase,
} from "@/lib/affiliate/planner/discovery/normalizeActivityName";
import type { TiqetsSuggestCandidate } from "@/lib/affiliate/planner/providers/tiqets/tiqetsSuggestClient";

/** Transport products are never an attraction match for general mustDo discovery. */
const REJECT_TOKENS = new Set(["bus", "transfer", "transfers", "shuttle", "transportation", "pickup"]);
/** Ticket-like wording supports — but never alone establishes — a high-confidence match. */
const TICKET_TOKENS = new Set(["ticket", "tickets", "entry", "admission", "pass"]);
/** Extra words allowed in the title's head segment beyond the query phrase for a high match. */
const MAX_HEAD_EXTRA_TOKENS = 2;
const MIN_QUERY_LENGTH = 3;

export type TiqetsCandidateMatch = {
  productId: string;
  title: string;
  matchConfidence: ActivityDiscoveryMatchConfidence;
};

/** Attraction part of a product title: text before ":", " - ", " – " or "|". */
function titleHead(title: string): string {
  return title.split(/:|\s[-–—]\s|\|/)[0] ?? title;
}

function classify(
  queryTokens: string[],
  candidate: TiqetsSuggestCandidate,
): ActivityDiscoveryMatchConfidence | null {
  const titleTokens = activityNameTokens(candidate.title);
  if (titleTokens.some((token) => REJECT_TOKENS.has(token))) return null;

  const headTokens = activityNameTokens(titleHead(candidate.title));
  if (headTokens.join(" ") === queryTokens.join(" ")) return "exact";

  if (!containsTokenPhrase(headTokens, queryTokens)) return null;
  if (headTokens.length - queryTokens.length > MAX_HEAD_EXTRA_TOKENS) return null;
  if (!titleTokens.some((token) => TICKET_TOKENS.has(token))) return null;
  return "high";
}

/**
 * Deterministic pick of one suggest candidate for a query.
 * exact = title head equals the query; high = query phrase inside a short head plus ticket wording.
 * Transport titles are rejected. Anything weaker → null (no product beats a wrong product).
 * Among equal-confidence candidates the first in response order wins (same attraction, variant choice).
 */
export function matchTiqetsCandidate(params: {
  query: string;
  candidates: readonly TiqetsSuggestCandidate[];
}): TiqetsCandidateMatch | null {
  const queryTokens = activityNameTokens(params.query);
  if (queryTokens.join("").length < MIN_QUERY_LENGTH) return null;

  let best: TiqetsCandidateMatch | null = null;
  for (const candidate of params.candidates) {
    const confidence = classify(queryTokens, candidate);
    if (!confidence) continue;
    if (confidence === "exact") {
      return { productId: candidate.productId, title: candidate.title, matchConfidence: "exact" };
    }
    best ??= { productId: candidate.productId, title: candidate.title, matchConfidence: "high" };
  }
  return best;
}
