/**
 * 항공사 문자열 정규화 → IATA 코드 추출
 * - 입력: "티웨이항공(TW)", "T'way Air", "TW", "대한항공 KE", "Korean Air"
 * - 출력: "TW", "KE", "OZ", "LJ", "7C", "ZE", "BX" 등 또는 null
 */

import { IMPORTED_AIRLINE_IATA_CODES } from "@/lib/airlines/airlineLogos";

/** 유효한 IATA 코드 집합 (2~3자) + import manifest 확장 */
const VALID_CODES = new Set([
  "KE", "OZ", "TW", "LJ", "7C", "ZE", "BX", "RS", "IC", "YP",
  "AC", "CX", "CI", "BR", "SQ", "QF", "EK", "EY",
  "LH", "BA", "AF", "KL", "DL", "UA", "AA", "NH", "JL",
  "MU", "CZ", "HU", "TG", "VN", "MH", "GA", "PR",
  ...IMPORTED_AIRLINE_IATA_CODES,
]);

/**
 * 한글/영문 항공사명 alias → IATA 코드 매핑
 * - 키는 사람이 읽기 좋은 문자열, 실제 매칭은 normalizeNameKey로 정규화된 값 기준
 */
const ALIAS_BY_CODE: Record<string, string[]> = {
  // 국내
  KE: [
    "대한항공",
    "대한 항공",
    "korean air",
    "koreanair",
    "korean airlines",
    "koreanairlines",
    "korean air lines",
    "kal",
  ],
  OZ: [
    "아시아나",
    "아시아나항공",
    "아시아나 항공",
    "asiana",
    "asiana airlines",
    "asianaairlines",
  ],
  TW: [
    "티웨이",
    "티웨이항공",
    "티웨이 항공",
    "t'way",
    "t'way air",
    "tway",
    "tway air",
    "twayair",
  ],
  LJ: ["진에어", "jinair", "jin air", "jin airlines", "jinairlines"],
  "7C": ["제주항공", "제주 항공", "jejuair", "jeju air", "jeju"],
  ZE: [
    "이스타",
    "이스타항공",
    "이스타 항공",
    "eastar",
    "eastar jet",
    "eastarjet",
  ],
  BX: ["에어부산", "airbusan", "air busan"],
  RS: ["에어서울", "airseoul", "air seoul"],

  // 확장: 국제선 주요 항공사
  SQ: [
    "싱가포르항공",
    "싱가포르 항공",
    "singapore airlines",
    "singaporeairlines",
    "singapore air",
    "singaporeair",
    "sia",
  ],
  TG: [
    "타이항공",
    "타이 항공",
    "thai airways",
    "thaiairways",
    "thai air",
    "thaiair",
  ],
  VN: [
    "베트남항공",
    "베트남 항공",
    "vietnam airlines",
    "vietnamairlines",
    "vietnam air",
    "vietnamair",
  ],
  PR: [
    "필리핀항공",
    "필리핀 항공",
    "philippine airlines",
    "philippineairlines",
    "philippine air",
    "philippineair",
  ],
  JL: [
    "일본항공",
    "일본 항공",
    "japan airlines",
    "japanairlines",
    "japan air",
    "japanair",
    "jal",
  ],
  NH: [
    "전일본공수",
    "전일본 공수",
    "all nippon airways",
    "allnipponairways",
    "all nippon",
    "allnippon",
    "ana",
  ],
  CX: [
    "캐세이퍼시픽",
    "캐세이 퍼시픽",
    "cathay pacific",
    "cathaypacific",
    "cathay",
  ],
  QF: [
    "콴타스",
    "콴타스항공",
    "콴타스 항공",
    "qantas",
    "qantas airways",
    "qantasairways",
  ],
};

function normalizeNameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    // 공백/특수문자 제거 (하이픈, 아포스트로피, 점 등)
    .replace(/[\s'".\-_/()]+/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

type AliasEntry = {
  code: string;
  norm: string;
};

const ALIAS_ENTRIES: AliasEntry[] = (() => {
  const entries: AliasEntry[] = [];
  for (const [code, aliases] of Object.entries(ALIAS_BY_CODE)) {
    for (const alias of aliases) {
      const norm = normalizeNameKey(alias);
      if (!norm) continue;
      entries.push({ code, norm });
    }
  }
  // 더 구체적인 alias(길이가 긴 것)를 우선 매칭하기 위해 길이 기준 내림차순 정렬
  entries.sort((a, b) => b.norm.length - a.norm.length);
  return entries;
})();

const ALIAS_EXACT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const entry of ALIAS_ENTRIES) {
    if (!map[entry.norm]) {
      map[entry.norm] = entry.code;
    }
  }
  return map;
})();

/**
 * 1) 괄호 안 2~3자 영문 코드 추출: (TW), (KE)
 */
function extractFromParens(s: string): string | null {
  const match = s.match(/\(([A-Z0-9]{2,3})\)/i);
  if (!match) return null;
  const code = match[1].toUpperCase();
  return VALID_CODES.has(code) ? code : null;
}

/** IATA 코드 길이 내림차순 (3자 코드 우선 시도) */
const VALID_CODES_BY_LENGTH = [...VALID_CODES].sort((a, b) => b.length - a.length);

/**
 * 2) 결합 토큰에서 항공사 코드 추출: "TW501" → "TW", "7C3211" → "7C"
 * 알려진 IATA 코드를 접두사로 매칭해 그리디 정규식 오매칭(TW5+01) 방지
 */
function extractFromFlightNumber(s: string): string | null {
  const tokens = s.split(/\s+/);
  for (const t of tokens) {
    const token = t.trim().toUpperCase();
    if (!token) continue;
    for (const code of VALID_CODES_BY_LENGTH) {
      if (!token.startsWith(code)) continue;
      const rest = token.slice(code.length);
      if (/^\d{1,4}[A-Z]?$/.test(rest)) return code;
    }
  }
  return null;
}

/**
 * 3) 문자열 내 코드 토큰 추출: "KE", "OZ", "TW", "LJ", "7C", "ZE", "BX" 등
 * 단어 경계 또는 공백으로 구분된 2~3자 영문/숫자
 */
function extractCodeToken(s: string): string | null {
  const tokens = s.split(/[\s/]+/);
  for (const t of tokens) {
    const cleaned = t.replace(/[^A-Z0-9]/gi, "");
    if (cleaned.length >= 2 && cleaned.length <= 3) {
      const code = cleaned.toUpperCase();
      if (VALID_CODES.has(code)) return code;
    }
  }
  for (const code of VALID_CODES) {
    const re = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(s)) return code;
  }
  return null;
}

function lookupByName(s: string): string | null {
  const normInput = normalizeNameKey(s);
  if (!normInput) return null;

  // (a) 완전 일치 우선
  const exact = ALIAS_EXACT[normInput];
  if (exact) return exact;

  // (b) 부분 포함 매칭: 더 긴 alias(norm 길이 기준)가 먼저 검사됨
  for (const entry of ALIAS_ENTRIES) {
    if (normInput.includes(entry.norm)) {
      return entry.code;
    }
  }

  return null;
}

/**
 * 항공사 문자열 → IATA 코드 정규화
 * @param input 항공사명/코드 (예: "티웨이항공(TW)", "T'way Air", "TW", "대한항공 KE")
 * @returns IATA 2~3자 코드 또는 null
 */
export function normalizeAirline(input: string): string | null {
  const s = input?.trim();
  if (!s) return null;

  const fromParens = extractFromParens(s);
  if (fromParens) return fromParens;

  const fromFlightNumber = extractFromFlightNumber(s);
  if (fromFlightNumber) return fromFlightNumber;

  const fromToken = extractCodeToken(s);
  if (fromToken) return fromToken;

  const fromName = lookupByName(s);
  if (fromName) return fromName;

  return null;
}
