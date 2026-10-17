/**
 * Verified Klook city IDs keyed by canonical "cityEnglish|countryCode".
 * Add only IDs confirmed in the Klook / Travelpayouts widget generator — never inferred.
 */
const KLOOK_CITY_IDS: Readonly<Record<string, string>> = {
  "Osaka|JP": "29",
};

export function resolveKlookCityId(params: {
  cityEnglish: string | null;
  countryCode: string | null;
}): string | null {
  const city = params.cityEnglish?.trim();
  const country = params.countryCode?.trim().toUpperCase();
  if (!city || !country) return null;
  return KLOOK_CITY_IDS[`${city}|${country}`] ?? null;
}
