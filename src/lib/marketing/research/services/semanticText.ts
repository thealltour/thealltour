import { normalizeTitle } from "@/lib/marketing/research/fingerprint";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

/** Deterministic embedding input — excludes raw body boilerplate. */
export function buildSemanticResearchText(signal: ResearchSignal): string {
  const title = normalizeTitle(signal.title);
  const summary = normalizeTitle(signal.claim ?? signal.summary).slice(0, 280);
  const destinations = [...signal.destinations].sort().join(",");
  const topics = [...signal.topics].sort().slice(0, 6).join(",");
  const entities = [...signal.entities].sort().slice(0, 4).join(",");

  return [
    `type:${signal.signalType}`,
    `title:${title}`,
    `summary:${summary}`,
    destinations ? `dest:${destinations}` : "",
    topics ? `topics:${topics}` : "",
    entities ? `entities:${entities}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
