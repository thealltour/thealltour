export const COLLAPSE_LINE_LIMIT = 12;
export const COLLAPSE_CHAR_LIMIT = 800;

export function needsDescriptionCollapse(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n");
  return normalized.split("\n").length > COLLAPSE_LINE_LIMIT || normalized.length > COLLAPSE_CHAR_LIMIT;
}

export function collapsedPreview(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").slice(0, COLLAPSE_LINE_LIMIT).join("\n");
  const clipped = lines.length > COLLAPSE_CHAR_LIMIT ? lines.slice(0, COLLAPSE_CHAR_LIMIT) : lines;
  return clipped.trimEnd();
}

export function previewNoticeLines(lines: string[]): { lines: string[]; hasMore: boolean } {
  const fullText = lines.join("\n");
  if (!needsDescriptionCollapse(fullText)) {
    return { lines, hasMore: false };
  }
  const previewText = collapsedPreview(fullText);
  const previewLines = previewText.split("\n").filter((line) => line.length > 0);
  const hasMore = previewText.length < fullText.trimEnd().length;
  return { lines: previewLines, hasMore };
}
