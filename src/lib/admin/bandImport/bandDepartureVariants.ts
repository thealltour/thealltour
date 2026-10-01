/** 출발지별로 나눠 올린 한글 문서(HWP)를 상품 묶음으로 만들 때 쓰는 순수 함수. 등록 화면(클라이언트)에서도 사용 */

export const MAX_BAND_HWP_FILES = 4;
/** hwpParser.MAX_HWP_FILE_BYTES와 같은 값 (hwpParser는 server-only라 클라이언트용으로 따로 둔다) */
export const MAX_BAND_HWP_FILE_BYTES = 20 * 1024 * 1024;

/** 등록 화면 → import-band API로 넘기는 임시 저장소의 HWP 항목 */
export type BandStagingHwpFile = {
  path: string;
  filename: string;
  departureCity: string | null;
};

const CITY_ALIASES: Array<{ city: string; tokens: string[] }> = [
  { city: "인천", tokens: ["인천", "ICN"] },
  { city: "김포", tokens: ["김포", "GMP"] },
  { city: "부산", tokens: ["부산", "김해", "PUS"] },
  { city: "대구", tokens: ["대구", "TAE"] },
  { city: "청주", tokens: ["청주", "CJJ"] },
  { city: "광주", tokens: ["광주", "KWJ"] },
  { city: "무안", tokens: ["무안", "MWX"] },
  { city: "양양", tokens: ["양양", "YNY"] },
  { city: "제주", tokens: ["제주", "CJU"] },
];

const KOREAN_CITY_TOKENS = CITY_ALIASES.flatMap((alias) =>
  alias.tokens.filter((token) => /[가-힣]/.test(token)),
);

const FILENAME_DEPARTURE_RE = new RegExp(`(${KOREAN_CITY_TOKENS.join("|")})\\s*출발`);

function canonicalCity(token: string): string | null {
  const upper = token.trim().toUpperCase();
  for (const alias of CITY_ALIASES) {
    if (alias.tokens.some((t) => t.toUpperCase() === upper)) return alias.city;
  }
  return null;
}

/** "부산출발", "부산 출발", " 부산 " → "부산". 비어 있으면 null */
export function normalizeDepartureCity(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s*출발$/, "").trim();
  if (!trimmed) return null;
  return canonicalCity(trimmed) ?? trimmed;
}

/** 파일명에 "부산출발"처럼 출발지가 적혀 있으면 도시명을 돌려준다 */
export function guessDepartureCityFromFilename(filename: string): string | null {
  const match = filename.match(FILENAME_DEPARTURE_RE);
  if (!match) return null;
  return canonicalCity(match[1]) ?? match[1];
}

/** AI가 뽑은 가는편 출발 공항 문자열("인천 국제공항", "PUS")에서 도시명을 찾는다 */
export function departureCityFromAirport(airport: string | null | undefined): string | null {
  if (typeof airport !== "string" || !airport.trim()) return null;
  for (const alias of CITY_ALIASES) {
    for (const token of alias.tokens) {
      const isCode = /^[A-Z]{3}$/.test(token);
      const hit = isCode
        ? new RegExp(`\\b${token}\\b`, "i").test(airport)
        : airport.includes(token);
      if (hit) return alias.city;
    }
  }
  return null;
}

export function resolveDepartureCity(input: {
  explicit?: string | null;
  filename?: string | null;
  airport?: string | null;
}): string | null {
  return (
    normalizeDepartureCity(input.explicit) ??
    (input.filename ? guessDepartureCityFromFilename(input.filename) : null) ??
    departureCityFromAirport(input.airport)
  );
}

export function formatDepartureLabel(city: string): string {
  return `${city}출발`;
}

/** 상품명에 출발지가 없으면 " (부산출발)"을 붙인다 */
export function appendDepartureToTitle(title: string, city: string | null | undefined): string {
  const trimmed = title.trim();
  if (!city) return trimmed;
  if (trimmed.includes(city)) return trimmed;
  return `${trimmed} (${formatDepartureLabel(city)})`;
}
