import { canonicalEnglishCountryNameFromIso } from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import type { AffiliateDestination } from "@/lib/affiliate/planner/types";

/**
 * Provider-neutral affiliate search destination (no network, no LLM, no translation API).
 * Display text stays Korean for UI; providers receive `searchText` only in their target URLs.
 */
export type AffiliateCanonicalDestination = {
  /** Planner display text (unchanged, used for UI labels). */
  displayText: string;
  /** Provider search query: "City, Country" when canonical, otherwise raw display text. */
  searchText: string;
  /** Canonical English city name when an alias matched; null on raw fallback. */
  cityEnglish: string | null;
  countryCode: string | null;
  countryEnglish: string | null;
};

type AffiliateCityAlias = { cityEnglish: string; countryCode: string };

/**
 * Korean Planner destination → canonical English city, scoped to destinations the Planner
 * actually offers (PLANNER_POPULAR_DESTINATIONS + QA presets). Unlisted text falls back raw.
 * `countryCode` guards against same-name cities elsewhere; it is never used to infer a country.
 */
const AFFILIATE_CITY_ALIASES: Record<string, AffiliateCityAlias> = {
  오사카: { cityEnglish: "Osaka", countryCode: "JP" },
  후쿠오카: { cityEnglish: "Fukuoka", countryCode: "JP" },
  도쿄: { cityEnglish: "Tokyo", countryCode: "JP" },
  다낭: { cityEnglish: "Da Nang", countryCode: "VN" },
  방콕: { cityEnglish: "Bangkok", countryCode: "TH" },
  타이베이: { cityEnglish: "Taipei", countryCode: "TW" },
};

const LOWERCASE_COUNTRY_JOINERS = new Set(["and", "of"]);

function aliasKey(text: string): string {
  return text.replace(/\s+/g, "");
}

export function hasAffiliateCityAlias(displayText: string): boolean {
  return aliasKey(displayText.trim()) in AFFILIATE_CITY_ALIASES;
}

/**
 * ISO alpha-2 → display-cased English country name ("JP" → "Japan").
 * Derived from the Airalo canonical table (lowercase feed tokens) to keep one country SSOT.
 */
export function affiliateCountryEnglishLabel(iso: string | null | undefined): string | null {
  const token = canonicalEnglishCountryNameFromIso(iso);
  if (!token) return null;
  return token
    .split(" ")
    .map((word, index) =>
      index > 0 && LOWERCASE_COUNTRY_JOINERS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function resolveAffiliateCanonicalDestination(
  destination: Pick<AffiliateDestination, "text" | "countryCode">,
): AffiliateCanonicalDestination {
  const displayText = destination.text.trim();
  const countryCode = destination.countryCode?.trim().toUpperCase() || null;
  const countryEnglish = affiliateCountryEnglishLabel(countryCode);

  const alias = AFFILIATE_CITY_ALIASES[aliasKey(displayText)];
  if (!alias || (countryCode && countryCode !== alias.countryCode)) {
    return { displayText, searchText: displayText, cityEnglish: null, countryCode, countryEnglish };
  }

  return {
    displayText,
    searchText: countryEnglish ? `${alias.cityEnglish}, ${countryEnglish}` : alias.cityEnglish,
    cityEnglish: alias.cityEnglish,
    countryCode,
    countryEnglish,
  };
}
