import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { getAirlineLogoCandidates } from "@/lib/airlines/getAirlineLogoCandidates";
import { buildAirlinePlaceholderDataUri } from "@/lib/airlines/airlinePlaceholderDataUri";

/**
 * 편명·항공사 문자열 → 로고 URL 후보
 * 1) self-hosted SVG  2) env 템플릿  3) data URI placeholder (항상 성공)
 * 외부 CDN(Kiwi 등)은 배포 환경에서 불안정해 사용하지 않음.
 */
export function resolveAirlineLogoUrls(airlineText: string): string[] {
  const raw = airlineText?.trim();
  if (!raw || raw === "—") return [];

  const code = normalizeAirline(raw);
  const urls: string[] = [];

  const push = (url: string | null | undefined) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  if (code) {
    push(AIRLINE_LOGO_BY_CODE[code]);
    for (const candidate of getAirlineLogoCandidates(code)) {
      push(candidate);
    }
    push(buildAirlinePlaceholderDataUri(code));
  }

  return urls;
}
