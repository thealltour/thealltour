import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  projectResearchSource,
} from "@/lib/marketing/research/sources/sourceRegistry";

export const MVP_RESEARCH_SOURCES: Array<
  Omit<ResearchSource, "createdAt" | "updatedAt">
> = EXTERNAL_RESEARCH_SOURCE_REGISTRY.map(projectResearchSource);

/** Deferred Source Portfolio v1 entries (no safe RSS/API path verified yet). */
export const DEFERRED_RESEARCH_SOURCES_V1 = [
  {
    name: "외교부 해외안전여행 (0404.go.kr)",
    reason: "No stable public RSS/Atom endpoint verified; HTML portal only — defer custom adapter.",
    intendedRole: "korean_official_public",
  },
  {
    name: "JNTO / japan.travel news RSS",
    reason: "Advertised RSS URL returns HTML landing page, not a feed.",
    intendedRole: "destination_official",
  },
  {
    name: "Tourism Authority of Thailand",
    reason: "RSS endpoint returned HTTP 403; needs confirmed public feed/API.",
    intendedRole: "destination_official",
  },
  {
    name: "Taiwan Tourism (eng.taiwan.net.tw/rss)",
    reason: "Endpoint returned HTML rather than RSS.",
    intendedRole: "destination_official",
  },
  {
    name: "Philippines DOT tourism.gov.ph/rss",
    reason: "Feed XML present but empty (0 items); keep watching.",
    intendedRole: "destination_official",
  },
] as const;

export function isResearchCollectionEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.RESEARCH_COLLECTION_ENABLED?.trim().toLowerCase() === "true";
}

export function isCollectorEnabled(
  collectorId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const globalOff = env.RESEARCH_COLLECTION_ENABLED?.trim().toLowerCase() === "false";
  if (globalOff) return false;

  const key = `RESEARCH_${collectorId.toUpperCase().replace(/-/g, "_")}_ENABLED`;
  const value = env[key]?.trim().toLowerCase();
  if (value === "false") return false;
  return true;
}
