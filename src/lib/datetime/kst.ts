/**
 * Asia/Seoul(KST, UTC+9 고정 · DST 없음) 기준 오늘/특정 시각의 YYYY-MM-DD 문자열.
 *
 * 이 함수는 기존에 아래 3곳에 개별적으로 구현되어 있던 로직의 정본이다
 * (동등성은 오프셋 가산 방식과 Intl 방식을 다수 샘플로 대조해 확인함):
 * - `src/lib/inquiry/desiredDeparture.ts`의 `kstTodayYmd`
 * - `src/lib/adminLandings/kakaoSyncAnalyticsRange.ts`의 `kstYmd`
 * - `src/lib/hardcodedLandings/kakaoSyncGolf/dailySocialProofCount.ts`의 `getKstDateKey`
 */
export function formatKstYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
