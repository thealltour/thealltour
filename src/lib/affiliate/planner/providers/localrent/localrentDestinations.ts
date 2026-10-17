/**
 * Localrent destinations verified against public Localrent data — never inferred.
 * Each entry was confirmed in www.localrent.com/json/<countryId>/general/ (city id + translit slug +
 * Korean name) and by opening the Korean deep link (/ko/<countrySlug>/ … currency=KRW), which kept
 * the city ids, dates and KRW. Unlisted cities (e.g. Tokyo, Guam, Los Angeles) have no offer.
 */
export type LocalrentDestination = {
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  localrentCountryId: number;
  countrySlug: string;
  citySlug: string;
  cityId: number;
  /** Korean city name used in card copy. */
  labelKo: string;
  /** Planner destination spellings (Korean + English), matched after normalization only. */
  aliases: readonly string[];
};

export const LOCALRENT_DESTINATIONS: readonly LocalrentDestination[] = [
  {
    countryCode: "IT",
    localrentCountryId: 13,
    countrySlug: "italy",
    citySlug: "rome",
    cityId: 54441,
    labelKo: "로마",
    aliases: ["로마", "Rome"],
  },
  {
    countryCode: "IT",
    localrentCountryId: 13,
    countrySlug: "italy",
    citySlug: "milan",
    cityId: 53061,
    labelKo: "밀라노",
    aliases: ["밀라노", "Milan"],
  },
  {
    countryCode: "IT",
    localrentCountryId: 13,
    countrySlug: "italy",
    citySlug: "florence",
    cityId: 120371,
    labelKo: "피렌체",
    aliases: ["피렌체", "Florence"],
  },
  {
    countryCode: "FR",
    localrentCountryId: 12,
    countrySlug: "france",
    citySlug: "paris",
    cityId: 53741,
    labelKo: "파리",
    aliases: ["파리", "Paris"],
  },
  {
    countryCode: "ES",
    localrentCountryId: 35,
    countrySlug: "spain",
    citySlug: "barcelona",
    cityId: 60691,
    labelKo: "바르셀로나",
    aliases: ["바르셀로나", "Barcelona"],
  },
  {
    countryCode: "ES",
    localrentCountryId: 35,
    countrySlug: "spain",
    citySlug: "madrid",
    cityId: 51891,
    labelKo: "마드리드",
    aliases: ["마드리드", "Madrid"],
  },
  {
    countryCode: "TH",
    localrentCountryId: 9,
    countrySlug: "thailand",
    citySlug: "bangkok",
    cityId: 62861,
    labelKo: "방콕",
    aliases: ["방콕", "Bangkok"],
  },
  {
    countryCode: "TH",
    localrentCountryId: 9,
    countrySlug: "thailand",
    citySlug: "chiang_mai",
    cityId: 84061,
    labelKo: "치앙마이",
    aliases: ["치앙마이", "Chiang Mai"],
  },
];

/**
 * Planner destinations Localrent splits into several pickup locations (Phuket: airport, Patong,
 * Kata, … in the public city list). No single city id is correct, so these never get an offer.
 */
export const LOCALRENT_AMBIGUOUS_ALIASES: readonly { countryCode: string; aliases: readonly string[] }[] = [
  { countryCode: "TH", aliases: ["푸켓", "Phuket"] },
];

/** Exact hosts for the Partner Links source URL (no wildcard). */
export const LOCALRENT_ALLOWED_HOSTS = ["www.localrent.com", "localrent.com"] as const;

export const LOCALRENT_EXCLUDED_COUNTRY_CODES: readonly string[] = ["KR"];

/**
 * Travelpayouts attribution observed in a live Partner Links call for a localrent.com URL
 * (campaign_id=87, p=2043). Documentation only — never sent in the Partner Links request.
 */
export const LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID = "87";
export const LOCALRENT_TRAVELPAYOUTS_PRODUCT_ID = "2043";
