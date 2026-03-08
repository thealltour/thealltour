/**
 * PR8.10: 이미지 URL 정규화 단일 규칙.
 * - trim, 연속 공백 단일화. protocol/query/slash 등 공격적 변경 금지.
 * - DnD, validation, serialize, hydrate 모두 이 함수 사용.
 */

export function normalizeImageUrl(url: string): string {
  if (url == null || typeof url !== "string") return "";
  return url.trim().replace(/\s+/g, " ").trim();
}
