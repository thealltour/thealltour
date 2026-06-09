export type GolfBriefSnapshot = {
  group_size?: string;
  rounds?: string;
  target_region?: string;
  accommodation?: string;
  budget?: string;
  callback_time?: string;
};

export const GOLF_GROUP_SIZE_OPTIONS = ["2명", "3~4명", "5~8명", "9명 이상"] as const;
export const GOLF_ROUNDS_OPTIONS = ["1라운드", "2라운드", "3라운드", "4라운드 이상"] as const;
export const GOLF_ACCOMMODATION_OPTIONS = ["4성급", "5성급", "리조트", "상담 후 결정"] as const;
export const GOLF_BUDGET_OPTIONS = ["100만원대", "200만원대", "300만원대", "400만원 이상", "상담 후 결정"] as const;
export const CALLBACK_TIME_OPTIONS = [
  "오전 (09~12시)",
  "오후 (12~18시)",
  "저녁 (18~21시)",
  "언제든 가능",
] as const;

export function isGolfBriefContext(options: {
  quoteCategory?: string | null;
  productTitle?: string | null;
  landingSlug?: string | null;
}): boolean {
  const text = [options.quoteCategory, options.productTitle, options.landingSlug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /골프|golf|park.?golf|파크골프/.test(text);
}

export function golfBriefToContentLines(brief: GolfBriefSnapshot): string[] {
  const lines: string[] = [];
  if (brief.group_size) lines.push(`인원: ${brief.group_size}`);
  if (brief.rounds) lines.push(`라운드: ${brief.rounds}`);
  if (brief.target_region?.trim()) lines.push(`희망 지역: ${brief.target_region.trim()}`);
  if (brief.accommodation) lines.push(`숙소: ${brief.accommodation}`);
  if (brief.budget) lines.push(`예산: ${brief.budget}`);
  if (brief.callback_time) lines.push(`연락 희망 시간: ${brief.callback_time}`);
  return lines;
}

export function mergeGolfBriefIntoContent(content: string, brief: GolfBriefSnapshot): string {
  const briefLines = golfBriefToContentLines(brief);
  if (briefLines.length === 0) return content.trim();
  const base = content.trim();
  return base ? `${briefLines.join("\n")}\n${base}` : briefLines.join("\n");
}
