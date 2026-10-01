import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";

const TRAVEL_KEYWORDS =
  /\b(travel|trip|tour|flight|airline|hotel|resort|visa|passport|destination|airport|tourism)\b/i;

export function slugifyDestination(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractDestinationFromTitle(title: string): string[] {
  const slug = slugifyDestination(title);
  if (!slug || slug.length < 2) return [];
  return [slug];
}

export function inferTopics(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const topics = new Set<string>(["travel"]);
  if (/visa|passport|entry/i.test(text)) topics.add("visa");
  if (/flight|airline|airport/i.test(text)) topics.add("flight");
  if (/hotel|resort|accommodation/i.test(text)) topics.add("hotel");
  if (/weather|storm|typhoon|hurricane/i.test(text)) topics.add("weather");
  if (/festival|event/i.test(text)) topics.add("event");
  if (/warning|advisory|safety|insurance/i.test(text)) topics.add("safety");
  return [...topics];
}

export type SignalTypeInference = {
  signalType: ResearchSignalType;
  /** False when no rule matched and the caller's terminal `fallback` was returned. */
  keywordMatched: boolean;
};

/** @deprecated Alias kept for existing imports. */
export type OfficialSignalTypeInference = SignalTypeInference;

/** `fallback` is the source's `semantics.classification.defaultSignalType`. */
export function inferOfficialSignalTypeDetailed(
  title: string,
  summary: string,
  fallback: ResearchSignalType,
): SignalTypeInference {
  const text = `${title} ${summary}`.toLowerCase();
  if (/visa|passport|entry requirement/i.test(text)) return { signalType: "entry_requirement", keywordMatched: true };
  if (/warning|insurance|safety|terror|crime/i.test(text)) return { signalType: "safety", keywordMatched: true };
  if (/policy|regulation|law/i.test(text)) return { signalType: "policy_change", keywordMatched: true };
  if (/flight|airline|airport/i.test(text)) return { signalType: "flight_route", keywordMatched: true };
  return { signalType: fallback, keywordMatched: false };
}

export function inferOfficialSignalType(
  title: string,
  summary: string,
  fallback: ResearchSignalType,
): ResearchSignalType {
  return inferOfficialSignalTypeDetailed(title, summary, fallback).signalType;
}

/**
 * A generic travel-keyword hit is a resolved `general_travel_news`, not a fallback;
 * `fallback` (the source's `defaultSignalType`) applies only when nothing matched.
 */
export function inferNewsSignalTypeDetailed(
  title: string,
  summary: string,
  fallback: ResearchSignalType,
): SignalTypeInference {
  const text = `${title} ${summary}`.toLowerCase();
  if (/visa|passport/i.test(text)) return { signalType: "visa", keywordMatched: true };
  if (/airfare|fare|ticket price/i.test(text)) return { signalType: "airfare", keywordMatched: true };
  if (/hotel|resort/i.test(text)) return { signalType: "hotel_resort", keywordMatched: true };
  if (/festival|event/i.test(text)) return { signalType: "event", keywordMatched: true };
  if (/weather|storm/i.test(text)) return { signalType: "weather", keywordMatched: true };
  if (TRAVEL_KEYWORDS.test(text)) return { signalType: "general_travel_news", keywordMatched: true };
  return { signalType: fallback, keywordMatched: false };
}

export function inferNewsSignalType(
  title: string,
  summary: string,
  fallback: ResearchSignalType,
): ResearchSignalType {
  return inferNewsSignalTypeDetailed(title, summary, fallback).signalType;
}

export function conservativeClaim(summary: string, title: string): string {
  const base = summary.trim() || title.trim();
  if (!base) return title.trim();
  if (base.length <= 240) return base;
  return `${base.slice(0, 237)}...`;
}
