/**
 * Agenda-seed travel direction / audience intent.
 * Distinct from language or Korean-market source: Korean copy can still be inbound/domestic/B2B.
 */

export type TravelDirection =
  | "outbound"
  | "inbound"
  | "domestic"
  | "industry_b2b"
  | "mixed"
  | "unknown";

/** Note: avoid \\b with Hangul — JS word boundaries are ASCII-centric. */
const INBOUND =
  /(인바운드|방한|외국인\s*관광|외국인\s*여행객|한국\s*여행\s*중|관광통역|관통사|관광객\s*유치|inbound|foreign\s*tourists?|visiting\s*korea)/i;

const DOMESTIC =
  /(국내\s*여행|국내\s*관광|여수세계섬박람회|섬박람회|제주를\s*즐기는|강원도|전주\s*한옥|domestic\s*travel|intra-?korea)/i;

const INDUSTRY_B2B =
  /(업무협약|\bmou\b|상장\s*여행사|여행업계|여행사\s*실적|공모전|한시자격|육아휴직|\bb2b\b|industry\s*news|trade\s*association)/i;

const OUTBOUND =
  /(해외여행|해외\s*여행|출국|한국발|해외\s*노선|패키지\s*여행|\boutbound\b|overseas\s*travel|from\s*korea\s*to)/i;

const FOREIGN_DEST_HINT =
  /(japan|tokyo|osaka|vietnam|danang|thailand|bangkok|taiwan|philippines|hawaii|guam|spain|paris|france|italy|australia|sydney|singapore|hong\s*kong|캐나다|일본|도쿄|오사카|베트남|다낭|태국|방콕|대만|필리핀|하와이|괌|스페인|프랑스|이탈리아|호주|시드니|싱가포르|홍콩|유럽|미국)/i;

function normalizeText(parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/[_-]+/g, " ").trim();
}

/**
 * Deterministic direction label for agenda-seed ranking (not evidence deletion).
 */
export function classifyTravelDirection(input: {
  title?: string;
  summary?: string;
  destinations?: string[];
  topics?: string[];
}): TravelDirection {
  const text = normalizeText([
    input.title ?? "",
    input.summary ?? "",
    ...(input.destinations ?? []),
    ...(input.topics ?? []),
  ]);
  if (!text) return "unknown";

  const inbound = INBOUND.test(text);
  const domestic = DOMESTIC.test(text);
  const industry = INDUSTRY_B2B.test(text);
  const outboundCue = OUTBOUND.test(text) || FOREIGN_DEST_HINT.test(text);

  const travelerFacingOutbound = outboundCue && !inbound && !domestic;
  const travelerFacingInbound = inbound && !outboundCue;
  const travelerFacingDomestic = domestic && !outboundCue && !inbound;

  if (travelerFacingOutbound && (inbound || domestic || industry)) return "mixed";
  if (travelerFacingOutbound) return "outbound";
  if (travelerFacingInbound) return "inbound";
  if (travelerFacingDomestic) return "domestic";
  if (industry && !outboundCue) return "industry_b2b";
  if (outboundCue && (inbound || domestic)) return "mixed";
  if (outboundCue) return "outbound";
  return "unknown";
}
