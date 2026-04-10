/**
 * Supabase `weather_cache.cache_key` 생성.
 * 동일 도시·기간 조합은 동일 키로 조회되어 API 호출을 줄입니다.
 */
export function normalizeCityForWeatherCache(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function buildWeatherCacheKey(city: string, startDate: string, endDate: string): string {
  const normalized = normalizeCityForWeatherCache(city);
  return `weather:${normalized}:${startDate.trim()}:${endDate.trim()}:v1`;
}
