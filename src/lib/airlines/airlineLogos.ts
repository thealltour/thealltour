/**
 * 항공사 IATA 코드 → self-hosted 로고 경로
 *
 * 로고 파일: public/assets/airlines/{IATA}.png
 * manifest: src/lib/airlines/data/imported-airline-logos.json (import 스크립트 생성)
 */

import importedLogos from "@/lib/airlines/data/imported-airline-logos.json";

const BASE = "/assets/airlines";

export type ImportedAirlineLogoEntry = {
  icao: string;
  name: string;
  source: string;
  active: boolean;
};

export type ImportedAirlineLogosManifest = Record<string, ImportedAirlineLogoEntry>;

const MANIFEST = importedLogos as ImportedAirlineLogosManifest;

/** import된 IATA 코드 집합 (normalizeAirline VALID_CODES 확장용) */
export const IMPORTED_AIRLINE_IATA_CODES = Object.keys(MANIFEST);

/**
 * IATA 코드 → 로고 public URL (/assets/airlines/{IATA}.png)
 * manifest에 있는 경우만 반환
 */
export function getAirlineLogoPath(iata: string | null | undefined): string | null {
  const code = iata?.trim().toUpperCase();
  if (!code || !MANIFEST[code]) return null;
  return `${BASE}/${code}.png`;
}

/** @deprecated manifest 기반 — 하위 호환용 */
export const AIRLINE_LOGO_BY_CODE: Record<string, string> = Object.fromEntries(
  IMPORTED_AIRLINE_IATA_CODES.map((code) => [code, getAirlineLogoPath(code)!]),
);

export function getImportedAirlineLogoEntry(
  iata: string | null | undefined,
): ImportedAirlineLogoEntry | null {
  const code = iata?.trim().toUpperCase();
  if (!code) return null;
  return MANIFEST[code] ?? null;
}

export { MANIFEST as IMPORTED_AIRLINE_LOGOS_MANIFEST };
