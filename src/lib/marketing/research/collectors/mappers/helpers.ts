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

export function inferOfficialSignalType(title: string, summary: string): ResearchSignalType {
  const text = `${title} ${summary}`.toLowerCase();
  if (/visa|passport|entry requirement/i.test(text)) return "entry_requirement";
  if (/warning|insurance|safety|terror|crime/i.test(text)) return "safety";
  if (/policy|regulation|law/i.test(text)) return "policy_change";
  if (/flight|airline|airport/i.test(text)) return "flight_route";
  return "entry_requirement";
}

export function inferNewsSignalType(title: string, summary: string): ResearchSignalType {
  const text = `${title} ${summary}`.toLowerCase();
  if (/visa|passport/i.test(text)) return "visa";
  if (/airfare|fare|ticket price/i.test(text)) return "airfare";
  if (/hotel|resort/i.test(text)) return "hotel_resort";
  if (/festival|event/i.test(text)) return "event";
  if (/weather|storm/i.test(text)) return "weather";
  if (TRAVEL_KEYWORDS.test(text)) return "general_travel_news";
  return "general_travel_news";
}

export function conservativeClaim(summary: string, title: string): string {
  const base = summary.trim() || title.trim();
  if (!base) return title.trim();
  if (base.length <= 240) return base;
  return `${base.slice(0, 237)}...`;
}
