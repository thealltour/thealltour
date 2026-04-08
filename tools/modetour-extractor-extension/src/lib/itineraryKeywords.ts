/**
 * 텍스트 일정 파서용: 짧은 줄이라도 여행 일정상 중요한 키워드가 있으면 이벤트 후보로 인정.
 */
const SHORT_LINE_KEYWORDS = [
  "출발",
  "도착",
  "이동",
  "입국",
  "입국수속",
  "출국",
  "출국수속",
  "공항",
  "체크인",
  "호텔",
  "식사",
  "조식",
  "중식",
  "석식",
  "자유시간",
] as const;

export function isShortButImportant(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SHORT_LINE_KEYWORDS.some((k) => t.includes(k));
}
