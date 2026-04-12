/**
 * 관리자 모달에서 제목·CTA 후보 적용 시 전체 초안 문자열 조작
 */

/** 첫 번째 \\n\\n 앞을 새 제목으로 교체 */
export function applyBlogTitleCandidate(fullText: string, newTitle: string): string {
  const t = newTitle.trim();
  if (!t) return fullText;
  const idx = fullText.indexOf("\n\n");
  if (idx < 0) return t;
  return t + fullText.slice(idx);
}

const CTA_HEADER_FALLBACK = "👉 최종 조건 확인";

function lastLineIndexStartingWith(lines: string[], prefix: string): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trimStart().startsWith(prefix)) return i;
  }
  return -1;
}

/** 하단(마지막) 👉 CTA 블록 본문을 후보로 교체 — PR-BLOG-8 중간 CTA는 건드리지 않음 */
export function applyBlogCtaCandidate(fullText: string, candidateBody: string): string {
  const body = candidateBody.trim();
  if (!body) return fullText;

  const lines = fullText.split("\n");
  const start = lastLineIndexStartingWith(lines, "👉");

  if (start < 0) {
    const tail = fullText.trimEnd();
    return `${tail}\n\n${CTA_HEADER_FALLBACK}\n\n${body}`;
  }

  const header = lines[start]?.trim() || CTA_HEADER_FALLBACK;
  const before = lines.slice(0, start).join("\n").trimEnd();
  const mid = `${header}\n\n${body}`;
  return [before, mid].filter((p) => p.length > 0).join("\n\n");
}
