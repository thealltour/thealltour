/**
 * 항공사 코드/이름 정규화 → 로고 매핑
 * - Admin 입력(텍스트)을 IATA 코드로 변환 후 Kiwi CDN 로고 URL 반환
 * - 매핑 실패 시 null (fallback: Plane 아이콘 또는 텍스트)
 */

/** IATA 2자 코드 → 로고 URL (Kiwi CDN, 64px) */
const LOGO_BASE = "https://images.kiwi.com/airlines/64";

/**
 * 항공사 이름/코드 정규화 후 IATA 매핑
 * 키: 정규화된 문자열 (소문자, 공백/특수문자 제거, 한글/영문)
 */
const NAME_TO_IATA: Record<string, string> = {
  // 대한민국
  대한항공: "KE",
  koreanair: "KE",
  "korean air": "KE",
  아시아나: "OZ",
  아시아나항공: "OZ",
  asiana: "OZ",
  asianaairlines: "OZ",
  "asiana airlines": "OZ",
  제주항공: "7C",
  jejuair: "7C",
  "jeju air": "7C",
  진에어: "LJ",
  jinair: "LJ",
  "jin air": "LJ",
  에어부산: "BX",
  airbusan: "BX",
  "air busan": "BX",
  티웨이: "TW",
  tway: "TW",
  "t way": "TW",
  에어인천: "IC",
  airincheon: "IC",
  "air incheon": "IC",
  에어프레미아: "YP",
  airpremia: "YP",
  "air premia": "YP",
  // 주요 해외
  에어캐나다: "AC",
  aircanada: "AC",
  "air canada": "AC",
  캐세이퍼시픽: "CX",
  cathay: "CX",
  "cathay pacific": "CX",
  중화항공: "CI",
  chinaairlines: "CI",
  "china airlines": "CI",
  에바항공: "BR",
  eva: "BR",
  "eva air": "BR",
  싱가포르항공: "SQ",
  singapore: "SQ",
  "singapore airlines": "SQ",
  칸타스: "QF",
  qantas: "QF",
  에미레이트: "EK",
  emirates: "EK",
  에티하드: "EY",
  etihad: "EY",
  루프트한자: "LH",
  lufthansa: "LH",
  영국항공: "BA",
  britishairways: "BA",
  "british airways": "BA",
  에어프랑스: "AF",
  airfrance: "AF",
  "air france": "AF",
  KLM: "KL",
  klm: "KL",
  델타: "DL",
  delta: "DL",
  "delta airlines": "DL",
  유나이티드: "UA",
  united: "UA",
  "united airlines": "UA",
  아메리칸: "AA",
  american: "AA",
  "american airlines": "AA",
  전일본: "NH",
  ana: "NH",
  "all nippon": "NH",
  일본항공: "JL",
  jal: "JL",
  "japan airlines": "JL",
  중국동방: "MU",
  "china eastern": "MU",
  중국남방: "CZ",
  "china southern": "CZ",
  하이난: "HU",
  "hainan airlines": "HU",
  타이항공: "TG",
  thaiairways: "TG",
  "thai airways": "TG",
  베트남항공: "VN",
  vietnam: "VN",
  "vietnam airlines": "VN",
  말레이시아: "MH",
  malaysia: "MH",
  "malaysia airlines": "MH",
  가루다: "GA",
  garuda: "GA",
  "garuda indonesia": "GA",
  필리핀: "PR",
  philippine: "PR",
  "philippine airlines": "PR",
};

/** 알려진 IATA 2자 코드 (로고 존재 가능성 높음) */
const KNOWN_IATA = new Set([
  "KE", "OZ", "7C", "LJ", "BX", "TW", "IC", "YP",
  "AC", "CX", "CI", "BR", "SQ", "QF", "EK", "EY",
  "LH", "BA", "AF", "KL", "DL", "UA", "AA", "NH", "JL",
  "MU", "CZ", "HU", "TG", "VN", "MH", "GA", "PR",
]);

function normalize(input: string): string[] {
  const s = input.trim().toLowerCase();
  if (!s) return [];
  const candidates: string[] = [];
  const noSpace = s.replace(/\s+/g, "");
  const noSpecial = s.replace(/[^a-z가-힣0-9]/gi, "");
  candidates.push(noSpace, noSpecial);
  if (noSpecial.length >= 2) candidates.push(noSpecial);
  return [...new Set(candidates)];
}

/**
 * 항공사 이름/코드 → IATA 2자 코드
 * @returns IATA 코드 또는 null (매핑 실패)
 */
export function resolveAirlineIata(nameOrCode: string): string | null {
  const s = nameOrCode?.trim();
  if (!s) return null;

  const upper = s.toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(upper) && KNOWN_IATA.has(upper)) return upper;

  const candidates = normalize(s);
  for (const c of candidates) {
    const iata = NAME_TO_IATA[c];
    if (iata) return iata;
  }
  for (const [key, iata] of Object.entries(NAME_TO_IATA)) {
    const normKey = key.replace(/\s+/g, "").toLowerCase();
    if (candidates.some((c) => c.includes(normKey) || normKey.includes(c))) return iata;
  }
  return null;
}

/**
 * 항공사 이름/코드 → 로고 URL
 * @returns 로고 URL 또는 null (fallback용)
 */
export function getAirlineLogoUrl(nameOrCode: string): string | null {
  const iata = resolveAirlineIata(nameOrCode);
  if (!iata) return null;
  return `${LOGO_BASE}/${iata}.png`;
}
