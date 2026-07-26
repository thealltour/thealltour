/**
 * 카카오싱크 골프 랜딩 소셜프루프 배지용 "오늘 가입자 수".
 *
 * 실제 가입 DB를 조회하지 않는다. KST(UTC+9) 날짜를 시드로 한 결정론적 해시로
 * 75~150 사이 값을 만들어, 같은 날에는 항상 같은 값 · KST 00:00에 자연스럽게
 * 다음 값으로 전환되도록 한다. (실 데이터 아님)
 */

const MIN_COUNT = 75;
const MAX_COUNT = 150;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 YYYY-MM-DD 문자열 */
export function getKstDateKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

/** FNV-1a 스타일 32비트 해시 (외부 의존성 없이 결정론적 시드 생성) */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * KST 기준 오늘 날짜에 결정론적으로 매핑된 75~150 사이 정수를 반환한다.
 * `now`를 넘기지 않으면 실행 시각을 기준으로 계산한다.
 */
export function getKakaoSyncDailySocialProofCount(now: Date = new Date()): number {
  const dateKey = getKstDateKey(now);
  const hash = hashString(dateKey);
  return MIN_COUNT + (hash % (MAX_COUNT - MIN_COUNT + 1));
}
