import { isoFromCountryNameOrSlug } from "@/lib/affiliate/planner/providers/airalo/airaloCountry";

/**
 * Korean country display names (as Planner plans emit them) → ISO 3166-1 alpha-2.
 * Countries only — city/region names are never mapped here.
 */
const KOREAN_COUNTRY_NAME_TO_ISO: Record<string, string> = {
  일본: "JP",
  대한민국: "KR",
  한국: "KR",
  남한: "KR",
  베트남: "VN",
  태국: "TH",
  대만: "TW",
  중국: "CN",
  홍콩: "HK",
  마카오: "MO",
  필리핀: "PH",
  싱가포르: "SG",
  말레이시아: "MY",
  인도네시아: "ID",
  캄보디아: "KH",
  라오스: "LA",
  미얀마: "MM",
  몽골: "MN",
  인도: "IN",
  네팔: "NP",
  스리랑카: "LK",
  몰디브: "MV",
  우즈베키스탄: "UZ",
  카자흐스탄: "KZ",
  괌: "GU",
  미국: "US",
  캐나다: "CA",
  멕시코: "MX",
  호주: "AU",
  오스트레일리아: "AU",
  뉴질랜드: "NZ",
  피지: "FJ",
  영국: "GB",
  프랑스: "FR",
  독일: "DE",
  이탈리아: "IT",
  스페인: "ES",
  포르투갈: "PT",
  스위스: "CH",
  오스트리아: "AT",
  체코: "CZ",
  헝가리: "HU",
  크로아티아: "HR",
  그리스: "GR",
  네덜란드: "NL",
  벨기에: "BE",
  덴마크: "DK",
  노르웨이: "NO",
  스웨덴: "SE",
  핀란드: "FI",
  아이슬란드: "IS",
  폴란드: "PL",
  튀르키예: "TR",
  터키: "TR",
  아랍에미리트: "AE",
  이집트: "EG",
  모로코: "MA",
};

/** English variants not covered by the Airalo canonical-name table. */
const EXTRA_ENGLISH_ALIASES_TO_ISO: Record<string, string> = {
  "republic of korea": "KR",
  "korea republic of": "KR",
  "viet nam": "VN",
  "united states of america": "US",
  "great britain": "GB",
  "england": "GB",
};

/** First Korean name listed per ISO code (e.g. JP → 일본, AU → 호주). */
const ISO_TO_KOREAN_COUNTRY_LABEL: Record<string, string> = Object.entries(
  KOREAN_COUNTRY_NAME_TO_ISO,
).reduce<Record<string, string>>((acc, [name, iso]) => {
  acc[iso] ??= name;
  return acc;
}, {});

/** Korean country display label for an ISO alpha-2 code; unknown → null. */
export function koreanCountryLabelFromIso(iso: string | null | undefined): string | null {
  const code = iso?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return ISO_TO_KOREAN_COUNTRY_LABEL[code] ?? null;
}

function compactKorean(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function normalizeEnglish(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Deterministic local country identity for affiliate routing (no network).
 * Accepts ISO alpha-2, Korean country names, or English country names; unknown → null.
 */
export function resolveAffiliateCountryCode(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;

  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();

  const korean = KOREAN_COUNTRY_NAME_TO_ISO[compactKorean(value)];
  if (korean) return korean;

  const english = normalizeEnglish(value);
  if (!english) return null;
  return EXTRA_ENGLISH_ALIASES_TO_ISO[english] ?? isoFromCountryNameOrSlug(value);
}
