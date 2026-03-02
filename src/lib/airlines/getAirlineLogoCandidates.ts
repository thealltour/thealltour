const RAW_TEMPLATES = (process.env.NEXT_PUBLIC_AIRLINE_LOGO_TEMPLATES ?? "").split(",");

const TEMPLATES: string[] = RAW_TEMPLATES.map((item) => item.trim()).filter(
  (item) => item.length > 0,
);

/**
 * 환경변수 기반 항공사 로고 URL 후보 생성
 *
 * - env: NEXT_PUBLIC_AIRLINE_LOGO_TEMPLATES
 *   예) "https://cdn1.example.com/airlines/{code}.svg,https://cdn2.example.com/{code}.png"
 * - {code} 플레이스홀더는 대문자 IATA 코드로 치환
 * - env가 비어 있으면 [] 반환 (외부 로고 미사용)
 */
export function getAirlineLogoCandidates(code: string | null | undefined): string[] {
  if (!code) return [];
  if (!TEMPLATES.length) return [];

  const upper = code.toUpperCase();

  return TEMPLATES.map((tpl) => tpl.replace(/{code}/g, upper));
}

