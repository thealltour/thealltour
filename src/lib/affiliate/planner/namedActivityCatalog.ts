import { resolveAffiliateCanonicalDestination } from "@/lib/affiliate/planner/destinationCanonical";
import type { AffiliateDestination } from "@/lib/affiliate/planner/types";

/**
 * Provider-neutral named activity identity (Planner item name → canonical activity).
 * Static, exact-alias only: no network, no fuzzy search, no LLM. Provider source URLs live in
 * each provider module keyed by `NamedActivityId`, so this layer can later be replaced by a feed.
 */
export const NAMED_ACTIVITY_IDS = ["universal_studios_japan"] as const;

export type NamedActivityId = (typeof NAMED_ACTIVITY_IDS)[number];

export type NamedActivity = {
  id: NamedActivityId;
  /** Korean offer title (no price/discount wording). */
  titleKo: string;
  countryCode: string;
  cityEnglish: string;
};

type NamedActivityDefinition = NamedActivity & {
  /** Full names (Korean/English spellings). */
  names: string[];
  /** Short codes that may stand alone or sit directly before/after a full name. */
  codes: string[];
};

const NAMED_ACTIVITY_DEFINITIONS: NamedActivityDefinition[] = [
  {
    id: "universal_studios_japan",
    titleKo: "유니버설 스튜디오 재팬 입장권",
    countryCode: "JP",
    cityEnglish: "Osaka",
    names: ["유니버설 스튜디오 재팬", "유니버셜 스튜디오 재팬", "Universal Studios Japan"],
    codes: ["USJ"],
  },
];

/** NFKC, lowercase, safe punctuation/brackets → space, then whitespace removed (spacing variants match). */
export function normalizeNamedActivityKey(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[·・.,'’"“”\-_/()[\]{}]+/g, " ")
    .replace(/\s+/g, "");
}

/** Every accepted key is enumerated up front: name, code, name+code, code+name. Lookup is exact. */
const ALIAS_INDEX = new Map<string, NamedActivityDefinition>();
for (const def of NAMED_ACTIVITY_DEFINITIONS) {
  const codes = def.codes.map(normalizeNamedActivityKey);
  for (const code of codes) ALIAS_INDEX.set(code, def);
  for (const name of def.names.map(normalizeNamedActivityKey)) {
    ALIAS_INDEX.set(name, def);
    for (const code of codes) {
      ALIAS_INDEX.set(`${name}${code}`, def);
      ALIAS_INDEX.set(`${code}${name}`, def);
    }
  }
}

/**
 * Exact key match guarded by the trip country (never inferred; null country → no match).
 * A JP trip based outside Osaka (e.g. Kyoto) still matches: USJ is a common Kansai day trip.
 */
export function resolveNamedActivity(params: {
  placeName: string | null | undefined;
  destination: Pick<AffiliateDestination, "text" | "countryCode">;
}): NamedActivity | null {
  const key = normalizeNamedActivityKey(params.placeName ?? "");
  if (!key) return null;
  const def = ALIAS_INDEX.get(key);
  if (!def) return null;
  const countryCode = resolveAffiliateCanonicalDestination(params.destination).countryCode;
  if (countryCode !== def.countryCode) return null;
  return { id: def.id, titleKo: def.titleKo, countryCode: def.countryCode, cityEnglish: def.cityEnglish };
}
