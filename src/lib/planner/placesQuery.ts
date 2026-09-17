import type { PlannerPlanItem } from "@/lib/planner/planSchemas";

const RESOLVE_TYPES = new Set<PlannerPlanItem["type"]>([
  "attraction",
  "food",
  "cafe",
  "shopping",
  "activity",
]);

/** Soft generic activity phrases — not a specific mappable POI. */
const GENERIC_NAME_PATTERNS: RegExp[] = [
  /근처/,
  /주변/,
  /현지\s*맛집/,
  /분위기\s*좋은\s*카페/,
  /저녁\s*식사/,
  /점심\s*식사/,
  /아침\s*식사/,
  /조식/,
  /브런치/,
  /숙소\s*(체크|이동|휴식)?/,
  /^숙소$/,
  /휴식$/,
  /이동$/,
  /산책만/,
  /여유\s*시간/,
  /자유\s*시간/,
  /또는/,
];

export function shouldResolvePlannerItemType(type: PlannerPlanItem["type"]): boolean {
  return RESOLVE_TYPES.has(type);
}

/**
 * True when the item looks like a single concrete place worth Places Text Search.
 * Type must be eligible; generic meal/cafe/rest phrasing is skipped.
 */
export function isConcretePlannerPlaceCandidate(item: {
  type: PlannerPlanItem["type"];
  name: string;
}): boolean {
  if (!shouldResolvePlannerItemType(item.type)) return false;
  const name = item.name.trim();
  if (!name) return false;
  for (const re of GENERIC_NAME_PATTERNS) {
    if (re.test(name)) return false;
  }
  return true;
}

export function buildPlacesSearchQuery(params: {
  name: string;
  area: string | null;
  destination: string;
  country?: string | null;
}): string {
  const name = params.name.trim();
  const area = params.area?.trim() || "";
  const destination = params.destination.trim();
  const country = params.country?.trim() || "";
  return [name, area, destination, country].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function normalizePlaceDedupeKey(params: {
  destination: string;
  area: string | null;
  name: string;
}): string {
  return [params.destination, params.area ?? "", params.name]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

export type PlacesCandidate = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  googleMapsUri: string | null;
};

export type ScoredCandidate = PlacesCandidate & { score: number };

/**
 * Deterministic scoring. Thresholds:
 * - resolved: best >= 0.55 and gap to second >= 0.08 (or single candidate >= 0.55)
 * - ambiguous: best >= 0.35 but not resolved
 * - unresolved: otherwise
 */
export function scorePlacesCandidate(
  candidate: PlacesCandidate,
  query: { name: string; area: string | null; destination: string },
): number {
  const nameScore = Math.max(
    tokenOverlap(query.name, candidate.displayName),
    normalizeForCompare(candidate.displayName).includes(normalizeForCompare(query.name))
      ? 0.85
      : 0,
    normalizeForCompare(query.name).includes(normalizeForCompare(candidate.displayName))
      ? 0.7
      : 0,
  );

  const dest = normalizeForCompare(query.destination);
  const addr = normalizeForCompare(candidate.formattedAddress);
  const addressDest = dest && addr.includes(dest) ? 0.25 : 0;

  const area = query.area ? normalizeForCompare(query.area) : "";
  const addressArea = area && addr.includes(area) ? 0.15 : 0;

  const typeBonus =
    candidate.types.some((t) =>
      /tourist|attraction|restaurant|cafe|food|store|shopping|park|museum|lodging/i.test(t),
    )
      ? 0.05
      : 0;

  return Math.min(1, nameScore * 0.7 + addressDest + addressArea + typeBonus);
}

export function classifyPlacesCandidates(
  candidates: PlacesCandidate[],
  query: { name: string; area: string | null; destination: string },
): { status: "resolved" | "ambiguous" | "unresolved"; best: ScoredCandidate | null } {
  if (candidates.length === 0) {
    return { status: "unresolved", best: null };
  }
  const scored = candidates
    .map((c) => ({ ...c, score: scorePlacesCandidate(c, query) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const second = scored[1];

  if (best.score >= 0.55 && (!second || best.score - second.score >= 0.08 || scored.length === 1)) {
    return { status: "resolved", best };
  }
  if (best.score >= 0.35) {
    return { status: "ambiguous", best };
  }
  return { status: "unresolved", best: null };
}
