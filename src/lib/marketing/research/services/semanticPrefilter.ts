import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import { areSignalTypesSemanticallyCompatible } from "@/lib/marketing/research/services/signalTypeCompatibility";

const MS_PER_HOUR = 60 * 60 * 1000;

function overlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b.map((v) => v.toLowerCase()));
  return a.some((v) => setB.has(v.toLowerCase()));
}

function parseAnchorMs(signal: ResearchSignal): number {
  const raw = signal.publishedAt ?? signal.observedAt;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

function extractYears(text: string): number[] {
  const matches = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  return [...new Set(matches.map(Number))];
}

const TIME_SENSITIVE_TYPES = new Set([
  "weather",
  "seasonal_condition",
  "disruption",
  "airfare",
  "event",
  "festival",
]);

const ROUTE_SPECIFIC_TYPES = new Set(["flight_route", "airfare"]);

/** Country/policy advisories must share a destination — topic-only overlap is insufficient. */
const DESTINATION_SPECIFIC_TYPES = new Set([
  "policy_change",
  "entry_requirement",
  "visa",
  "safety",
]);

function requiresDestinationOverlap(a: ResearchSignal, b: ResearchSignal): boolean {
  return (
    DESTINATION_SPECIFIC_TYPES.has(a.signalType) ||
    DESTINATION_SPECIFIC_TYPES.has(b.signalType) ||
    ROUTE_SPECIFIC_TYPES.has(a.signalType) ||
    ROUTE_SPECIFIC_TYPES.has(b.signalType)
  );
}

/** False-positive guards beyond raw cosine similarity. */
export function passesSemanticMergeGuards(
  a: ResearchSignal,
  b: ResearchSignal,
  maxTimeSensitiveAgeHours: number,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!areSignalTypesSemanticallyCompatible(a.signalType, b.signalType)) {
    return { ok: false, reasons: ["signal_type_incompatible"] };
  }

  const destOverlap = overlap(a.destinations, b.destinations);
  const topicOverlap = overlap(a.topics, b.topics);
  if (!destOverlap && !topicOverlap) {
    return { ok: false, reasons: ["no_destination_or_topic_overlap"] };
  }

  if (requiresDestinationOverlap(a, b) && !destOverlap) {
    const reason = ROUTE_SPECIFIC_TYPES.has(a.signalType) || ROUTE_SPECIFIC_TYPES.has(b.signalType)
      ? "route_destination_mismatch"
      : "destination_specific_mismatch";
    return { ok: false, reasons: [reason] };
  }

  const yearsA = extractYears(`${a.title} ${a.summary}`);
  const yearsB = extractYears(`${b.title} ${b.summary}`);
  if (yearsA.length > 0 && yearsB.length > 0) {
    const shared = yearsA.some((y) => yearsB.includes(y));
    if (!shared) {
      return { ok: false, reasons: ["year_mismatch"] };
    }
  }

  const timeSensitive = TIME_SENSITIVE_TYPES.has(a.signalType) || TIME_SENSITIVE_TYPES.has(b.signalType);
  if (timeSensitive) {
    const ageHours = Math.abs(parseAnchorMs(a) - parseAnchorMs(b)) / MS_PER_HOUR;
    if (ageHours > maxTimeSensitiveAgeHours) {
      return { ok: false, reasons: [`temporal_gap_${Math.round(ageHours)}h`] };
    }
  }

  if (
    (a.signalType === "visa" || a.topics.includes("visa")) !==
    (b.signalType === "visa" || b.topics.includes("visa"))
  ) {
    const promoLike = /promotion|tourism campaign|visit|promote/i;
    if (promoLike.test(a.summary) || promoLike.test(b.summary)) {
      return { ok: false, reasons: ["visa_vs_promotion_boundary"] };
    }
  }

  reasons.push("guards_passed");
  return { ok: true, reasons };
}

export function isSemanticComparisonEligible(a: ResearchSignal, b: ResearchSignal): boolean {
  if (a.id === b.id) return false;
  if (!areSignalTypesSemanticallyCompatible(a.signalType, b.signalType)) return false;

  const destOverlap = overlap(a.destinations, b.destinations);
  const topicOverlap = overlap(a.topics, b.topics);
  if (!destOverlap && !topicOverlap) return false;
  if (requiresDestinationOverlap(a, b) && !destOverlap) return false;
  if (
    (ROUTE_SPECIFIC_TYPES.has(a.signalType) || ROUTE_SPECIFIC_TYPES.has(b.signalType)) &&
    !destOverlap
  ) {
    return false;
  }

  const anchorA = parseAnchorMs(a);
  const anchorB = parseAnchorMs(b);
  if (anchorA > 0 && anchorB > 0) {
    const ageDays = Math.abs(anchorA - anchorB) / (MS_PER_HOUR * 24);
    if (ageDays > 30) return false;
  }

  return true;
}

export function enumerateSemanticCandidatePairs(signals: ResearchSignal[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const a = signals[i]!;
      const b = signals[j]!;
      if (isSemanticComparisonEligible(a, b)) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}
