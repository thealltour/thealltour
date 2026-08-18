import { z } from "zod";

export type ThemeChartItem = { label: string; percent: number };
export type ThemeChartJson = { items: ThemeChartItem[] };

export const THEME_CHART_PROMPT_RULES = `- theme_chart_json: infer schedule composition from the itinerary (golf rounds, sightseeing, free time, meals, transfers, rest). 2–5 short Korean labels (골프, 관광, 자유일정, 식사, 이동, 휴식, 온천, 쇼핑, …). Integer percents summing to 100. Drop slices under 5%. Do NOT equally split theme/category tokens (e.g. "해외골프, 제주" → 50/50 is forbidden). Omit items that do not appear in the schedule. Use null when there is no itinerary.`;

export const themeChartItemSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(20)
    .describe("짧은 한글 테마 라벨 (예: 골프, 관광, 자유일정, 식사, 이동)"),
  percent: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("해당 테마가 일정에서 차지하는 정수 퍼센트"),
});

export const themeChartJsonSchema = z
  .object({
    items: z
      .array(themeChartItemSchema)
      .max(5)
      .describe("2~5개. 정수 % 합 100. 일정에 없는 항목은 넣지 말 것."),
  })
  .nullable()
  .describe(
    "일정 테마 구성비. 일정표의 시간 비중으로 판단. 없으면 null. theme/category 균등 분할 금지.",
  );

const MAX_ITEMS = 5;
const MAX_LABEL = 20;

function extractItems(raw: unknown): unknown[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && "items" in raw) {
    const items = (raw as { items: unknown }).items;
    return Array.isArray(items) ? items : null;
  }
  return null;
}

function largestRemainderPercents(values: number[]): number[] {
  const total = values.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return values.map(() => 0);

  const scaled = values.map((n) => {
    const exact = (n / total) * 100;
    const floored = Math.floor(exact);
    return { percent: floored, remainder: exact - floored };
  });
  let leftover = 100 - scaled.reduce((sum, row) => sum + row.percent, 0);
  const order = scaled
    .map((row, index) => ({ index, remainder: row.remainder }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (leftover <= 0) break;
    scaled[index].percent += 1;
    leftover -= 1;
  }
  return scaled.map((row) => row.percent);
}

/** AI/폼 값을 DB insert용 `{ items }`로 정규화. 유효 항목 2개 미만이면 null. */
export function normalizeThemeChartForInsert(raw: unknown): ThemeChartJson | null {
  const items = extractItems(raw);
  if (!items) return null;

  const cleaned: ThemeChartItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim().slice(0, MAX_LABEL) : "";
    if (!label) continue;
    const n = typeof rec.percent === "number" ? rec.percent : Number(rec.percent);
    if (!Number.isFinite(n)) continue;
    const percent = Math.max(0, Math.min(100, n));
    if (percent <= 0) continue;
    cleaned.push({ label, percent });
    if (cleaned.length >= MAX_ITEMS) break;
  }

  if (cleaned.length < 2) return null;

  const total = cleaned.reduce((sum, item) => sum + item.percent, 0);
  if (total <= 0) return null;

  if (Math.abs(total - 100) < 0.01) {
    const rounded = cleaned.map((item) => ({
      label: item.label,
      percent: Math.round(item.percent),
    }));
    const roundedTotal = rounded.reduce((sum, item) => sum + item.percent, 0);
    if (roundedTotal === 100) return { items: rounded };
    const adjusted = largestRemainderPercents(rounded.map((item) => item.percent));
    return {
      items: rounded.map((item, i) => ({ label: item.label, percent: adjusted[i] })),
    };
  }

  const percents = largestRemainderPercents(cleaned.map((item) => item.percent));
  return {
    items: cleaned.map((item, i) => ({ label: item.label, percent: percents[i] })),
  };
}
