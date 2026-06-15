import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { getAirlineLogoUrl } from "@/lib/airlines/airlineLogo";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { getAirlineLogoCandidates } from "@/lib/airlines/getAirlineLogoCandidates";

/**
 * 편명·항공사 문자열 → 로고 URL 후보 (로컬 자산 → Kiwi CDN → env 템플릿 순)
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
    push(`https://images.kiwi.com/airlines/64/${code}.png`);
    for (const candidate of getAirlineLogoCandidates(code)) {
      push(candidate);
    }
  }

  push(getAirlineLogoUrl(raw));
  if (code) push(getAirlineLogoUrl(code));

  return urls;
}
