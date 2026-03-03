/**
 * 붙여넣기 텍스트에서 상품명 후보를 추출합니다.
 * 클라이언트 전용, 실무자 입력 시간 단축용.
 */

const EXCLUDE_KEYWORDS = [
  "Day",
  "일차",
  "포함",
  "불포함",
  "주의",
  "유의",
  "가격",
  "출발",
  "도착",
  "항공",
  "호텔",
  "예약",
  "문의",
  "일정",
];

const LABEL_PATTERNS: Array<{ pattern: RegExp; groupIndex: number }> = [
  { pattern: /상품명\s*[:\-：]\s*(.+)/i, groupIndex: 1 },
  { pattern: /한줄\s*소개\s*[:\-：]\s*(.+)/i, groupIndex: 1 },
  { pattern: /요약\s*[:\-：]\s*(.+)/i, groupIndex: 1 },
];

const MIN_LENGTH = 8;
const MAX_LENGTH = 80;

function normalizeCandidate(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/["""]/g, '"');
}

function isExcludedLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return true;
  const lower = trimmed.toLowerCase();
  return EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export function extractTitleCandidates(input: string): string[] {
  if (!input || typeof input !== "string") return [];

  const lines = input
    .split(/\r?\n/)
    .map((l) => normalizeCandidate(l))
    .filter((l) => l.length >= MIN_LENGTH && l.length <= MAX_LENGTH);

  const labelMatches: string[] = [];
  const otherCandidates: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (isExcludedLine(line)) continue;

    let added = false;
    for (const { pattern, groupIndex } of LABEL_PATTERNS) {
      const m = line.match(pattern);
      if (m && m[groupIndex]) {
        const text = normalizeCandidate(m[groupIndex]);
        if (text.length >= MIN_LENGTH && text.length <= MAX_LENGTH && !seen.has(text)) {
          seen.add(text);
          labelMatches.push(text);
          added = true;
        }
        break;
      }
    }
    if (!added && !seen.has(line)) {
      seen.add(line);
      otherCandidates.push(line);
    }
  }

  const combined = [...labelMatches, ...otherCandidates];
  return combined.slice(0, 3);
}
