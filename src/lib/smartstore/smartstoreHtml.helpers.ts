/**
 * 스마트스토어 업로드용 HTML 조립 헬퍼 (외부 의존 최소화)
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ProductDetailV2.parseBulletLines 와 동일 규칙 */
export function parseBulletLines(raw?: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function filterEmptyLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** `[1일차]` 블록 파싱 — ProductDetailV2.parseScheduleDays 와 동일 */
export type ScheduleDayBlock = { label: string; content: string };

export function parseScheduleDayBlocks(raw?: string): ScheduleDayBlock[] {
  const source = raw?.trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const days: ScheduleDayBlock[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }
  const filtered = days.filter((d) => d.content.length > 0);
  if (filtered.length === 0 && source) return [{ label: "일정", content: source }];
  return filtered;
}

/** 인라인 스타일 조각 조합 (세미콜론 구분) */
export function styleAttr(parts: Record<string, string | undefined>): string {
  const s = Object.entries(parts)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return s ? ` style="${escapeHtml(s)}"` : "";
}
