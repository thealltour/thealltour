/**
 * 블로그 plain text 정제 전용 (HTML·스마트스토어 로직과 분리)
 */

/** 상품명·태그 노이즈 제거 */
export function cleanProductTitle(title: string | null | undefined): string {
  const t = (title ?? "")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t || "상품";
}

/** 목록/카테고리에 쓰기 부적절한 일반 라벨 제거 */
export function cleanCategory(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const t = text.trim();
  if (/액티비티|체험/i.test(t)) return "";
  if (t.includes("/")) return "";
  return t;
}

/** 일정·이벤트 원문에서 안내문·이모지·잡문 제거 */
export function cleanScheduleText(text: string): string {
  if (!text) return "";
  return text
    .replace(/💁.*?(\)|$)/g, "")
    .replace(/📍.*?(\)|$)/g, "")
    .replace(/※.*$/gm, "")
    .replace(/\(.*?입국.*?\)/g, "")
    .replace(/\(.*?수속.*?\)/g, "")
    .replace(/괌 국제공항.*?신고/g, "")
    .replace(/갤럭시.*?항공기에 실을/g, "")
    .replace(/\*.*?\*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 본문·불릿에 섞인 잡 이모지·특수기호 (섹션 헤더용 이모지는 빌더에서 별도 관리) */
export function sanitizeInlineNoise(text: string): string {
  if (!text) return "";
  return text
    .replace(/💁|★|✨|🔥|😍|💥/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function trimText(text: string, max = 30): string {
  const t = text.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** PR-BLOG-7: 대괄호·괄호·태그형 잡문 제거 (스마트스토어/상품명 노이즈) */
export function stripBlogRetailNoise(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/<.*?>/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 유의사항 원문 → 앞 2줄만 이어 붙여 짧은 요약 */
export function summarizeNotice(text: string): string {
  if (!text?.trim()) return "";
  const merged = text
    .split(/\n/)
    .slice(0, 2)
    .map((line) => sanitizeInlineNoise(line.trim()))
    .filter(Boolean)
    .join(" ");
  return cleanScheduleText(merged);
}
