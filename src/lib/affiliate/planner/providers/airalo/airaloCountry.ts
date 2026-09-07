/**
 * Airalo NEW feed country matching (PR-9C).
 *
 * Matching is ISO 3166-1 alpha-2 → canonical English country name against the
 * g:product_type COUNTRY segment (`esim > REGION > COUNTRY > …`).
 * No city→country inference; no fabricated feed countryCode attribute.
 */

/** Canonical English names as used in Airalo product_type country segments. */
const ISO_TO_CANONICAL_ENGLISH: Record<string, string> = {
  AF: "afghanistan",
  AL: "albania",
  DZ: "algeria",
  AD: "andorra",
  AO: "angola",
  AR: "argentina",
  AM: "armenia",
  AU: "australia",
  AT: "austria",
  AZ: "azerbaijan",
  BH: "bahrain",
  BD: "bangladesh",
  BY: "belarus",
  BE: "belgium",
  BZ: "belize",
  BO: "bolivia",
  BA: "bosnia and herzegovina",
  BW: "botswana",
  BR: "brazil",
  BN: "brunei",
  BG: "bulgaria",
  KH: "cambodia",
  CM: "cameroon",
  CA: "canada",
  CL: "chile",
  CN: "china",
  CO: "colombia",
  CR: "costa rica",
  HR: "croatia",
  CU: "cuba",
  CY: "cyprus",
  CZ: "czech republic",
  DK: "denmark",
  DO: "dominican republic",
  EC: "ecuador",
  EG: "egypt",
  SV: "el salvador",
  EE: "estonia",
  ET: "ethiopia",
  FJ: "fiji",
  FI: "finland",
  FR: "france",
  GE: "georgia",
  DE: "germany",
  GH: "ghana",
  GR: "greece",
  GU: "guam",
  GT: "guatemala",
  HN: "honduras",
  HK: "hong kong",
  HU: "hungary",
  IS: "iceland",
  IN: "india",
  ID: "indonesia",
  IR: "iran",
  IQ: "iraq",
  IE: "ireland",
  IL: "israel",
  IT: "italy",
  JM: "jamaica",
  JP: "japan",
  JO: "jordan",
  KZ: "kazakhstan",
  KE: "kenya",
  KW: "kuwait",
  KG: "kyrgyzstan",
  LA: "laos",
  LV: "latvia",
  LB: "lebanon",
  LI: "liechtenstein",
  LT: "lithuania",
  LU: "luxembourg",
  MO: "macau",
  MG: "madagascar",
  MY: "malaysia",
  MV: "maldives",
  MT: "malta",
  MU: "mauritius",
  MX: "mexico",
  MD: "moldova",
  MC: "monaco",
  MN: "mongolia",
  ME: "montenegro",
  MA: "morocco",
  MM: "myanmar",
  NP: "nepal",
  NL: "netherlands",
  NZ: "new zealand",
  NI: "nicaragua",
  NG: "nigeria",
  MK: "north macedonia",
  NO: "norway",
  OM: "oman",
  PK: "pakistan",
  PA: "panama",
  PY: "paraguay",
  PE: "peru",
  PH: "philippines",
  PL: "poland",
  PT: "portugal",
  PR: "puerto rico",
  QA: "qatar",
  RO: "romania",
  RU: "russia",
  RW: "rwanda",
  SA: "saudi arabia",
  SN: "senegal",
  RS: "serbia",
  SG: "singapore",
  SK: "slovakia",
  SI: "slovenia",
  ZA: "south africa",
  KR: "south korea",
  ES: "spain",
  LK: "sri lanka",
  SE: "sweden",
  CH: "switzerland",
  TW: "taiwan",
  TJ: "tajikistan",
  TZ: "tanzania",
  TH: "thailand",
  TL: "timor leste",
  TN: "tunisia",
  TR: "turkey",
  UG: "uganda",
  UA: "ukraine",
  AE: "united arab emirates",
  GB: "united kingdom",
  US: "united states",
  UY: "uruguay",
  UZ: "uzbekistan",
  VN: "vietnam",
  ZM: "zambia",
  ZW: "zimbabwe",
};

/** Accept common aliases when reading feed product_type country segments. */
const NAME_ALIASES_TO_ISO: Record<string, string> = {
  bosnia: "BA",
  czechia: "CZ",
  "hong kong sar china": "HK",
  "macao sar china": "MO",
  korea: "KR",
  turkiye: "TR",
  uae: "AE",
  uk: "GB",
  usa: "US",
};

const NAME_TO_ISO: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ISO_TO_CANONICAL_ENGLISH).map(([iso, name]) => [name, iso]),
  ),
  ...NAME_ALIASES_TO_ISO,
};

const REGIONAL_OR_GLOBAL_COUNTRY_TOKENS = new Set([
  "asia",
  "europe",
  "africa",
  "oceania",
  "americas",
  "north america",
  "south america",
  "middle east",
  "caribbean",
  "global",
  "world",
  "worldwide",
  "international",
  "regional",
  "multi country",
  "multicountry",
]);

/** Region bucket that marks multi-country / global packages (not Asia/Europe local buckets). */
const GLOBAL_OR_MULTI_REGION_TOKENS = new Set([
  "global",
  "world",
  "worldwide",
  "international",
  "regional",
  "multi country",
  "multicountry",
]);

export function normalizeCountryToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** ISO alpha-2 → canonical English name used to match feed product_type. */
export function canonicalEnglishCountryNameFromIso(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return ISO_TO_CANONICAL_ENGLISH[code] ?? null;
}

export function isoFromCountryNameOrSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = normalizeCountryToken(raw);
  if (!name) return null;
  return NAME_TO_ISO[name] ?? null;
}

/**
 * Safe extract of COUNTRY segment from real New Feed product_type:
 * `esim > REGION > COUNTRY > DATA TYPE > VOLUME > DAYS`
 * Returns normalized English token, or null if malformed / regional-only.
 */
export function parseAiraloProductTypeCountrySegment(
  productType: string | null | undefined,
): string | null {
  if (!productType) return null;
  const parts = productType
    .split(/>/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Require root + region + country at minimum.
  if (parts.length < 3) return null;
  const root = normalizeCountryToken(parts[0]!);
  if (root !== "esim" && root !== "esims") return null;

  const country = normalizeCountryToken(parts[2]!);
  if (!country) return null;
  if (REGIONAL_OR_GLOBAL_COUNTRY_TOKENS.has(country)) return null;
  return country;
}

export function parseAiraloProductTypeRegionSegment(
  productType: string | null | undefined,
): string | null {
  if (!productType) return null;
  const parts = productType
    .split(/>/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const root = normalizeCountryToken(parts[0]!);
  if (root !== "esim" && root !== "esims") return null;
  const region = normalizeCountryToken(parts[1]!);
  return region || null;
}

/**
 * True when product looks like a regional/global package (must not outrank local).
 * Local country plans often sit under geographic buckets (Asia/Europe) — those are fine.
 * Prefer g:is_bundle and explicit global/multi region labels.
 */
export function isAiraloRegionalOrGlobalProduct(params: {
  productType: string | null;
  isBundle: boolean | null;
}): boolean {
  if (params.isBundle === true) return true;
  const region = parseAiraloProductTypeRegionSegment(params.productType);
  if (region && GLOBAL_OR_MULTI_REGION_TOKENS.has(region)) return true;
  return false;
}

/**
 * Derive ISO from product_type COUNTRY segment only.
 * Does not invent a feed countryCode attribute or infer from cities/URL paths.
 */
export function deriveAiraloCountryCode(params: {
  productType: string | null;
  /** @deprecated Unused — kept off the call sites intentionally. */
  sourceUrl?: string;
}): string | null {
  const segment = parseAiraloProductTypeCountrySegment(params.productType);
  if (!segment) return null;
  return isoFromCountryNameOrSlug(segment);
}

/** Destination ISO matches feed product_type country segment via canonical English name. */
export function airaloProductTypeMatchesCountryCode(
  productType: string | null | undefined,
  countryCode: string,
): boolean {
  const expected = canonicalEnglishCountryNameFromIso(countryCode);
  if (!expected) return false;
  const segment = parseAiraloProductTypeCountrySegment(productType);
  if (!segment) return false;
  // Alias-tolerant: segment "korea" / "south korea" both resolve & compare via ISO.
  const segmentIso = isoFromCountryNameOrSlug(segment);
  const expectedIso = countryCode.trim().toUpperCase();
  if (segmentIso) return segmentIso === expectedIso;
  return segment === expected;
}
