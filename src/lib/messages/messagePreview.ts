/**
 * 발송 미리보기용 텍스트 정리 (자동 치환·과도한 trim 없음).
 */
export type MessagePreviewResult = {
  normalizedText: string;
  isEmpty: boolean;
  lineCount: number;
};

export function buildMessagePreview(text: string): MessagePreviewResult {
  const normalizedText = text.replace(/\u00a0/g, " ");
  const trimmed = normalizedText.trim();
  const isEmpty = trimmed.length === 0;
  const lineCount = normalizedText.length === 0 ? 0 : normalizedText.split(/\r\n|\r|\n/).length;
  return { normalizedText, isEmpty, lineCount };
}
