/**
 * Admin product form - 레거시 일정 파싱 / O·X 정규화 등 공통 헬퍼
 */

export type DayScheduleDraft = {
  label: string;
  content: string;
};

/** 레거시 상세 일정 텍스트 [1일차] ... 파싱 */
export function parseDetailedSchedule(value: string): DayScheduleDraft[] {
  const source = value.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const drafts: DayScheduleDraft[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        drafts.push({
          label: currentLabel,
          content: currentContent.join("\n").trim(),
        });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    drafts.push({
      label: currentLabel,
      content: currentContent.join("\n").trim(),
    });
  }

  if (drafts.length === 0) {
    return [{ label: "1일차", content: source }];
  }

  return drafts.map((item) => ({
    label: item.label.trim() || "일정",
    content: item.content,
  }));
}

export function normalizeOXValue(value?: string | null): "O" | "X" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "X";
  if (["o", "y", "yes", "예", "가능", "제공", "포함", "있음", "있다"].includes(normalized)) return "O";
  if (["x", "n", "no", "아니오", "불가", "미제공", "불포함", "없음", "없다"].includes(normalized)) return "X";
  if (normalized.includes("없") || normalized.includes("불가") || normalized.includes("미")) return "X";
  return "O";
}
