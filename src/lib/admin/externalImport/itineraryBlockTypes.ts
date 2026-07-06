export type ItineraryBlockKind = "meal" | "sightseeing" | "move" | "notice" | "other";

export type ItineraryBlockDisplayRole = "summary" | "activity";

export type ItineraryBlock = {
  day?: number;
  dateText?: string;
  dayTitle?: string;
  heading: string;
  description: string;
  imageUrls: string[];
  kind?: ItineraryBlockKind;
  timeText?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  displayRole?: ItineraryBlockDisplayRole;
};

export function isItineraryBlock(value: unknown): value is ItineraryBlock {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.heading === "string" && typeof o.description === "string";
}

export function normalizeItineraryBlocks(raw: unknown): ItineraryBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ItineraryBlock[] = [];
  for (const item of raw) {
    if (!isItineraryBlock(item)) continue;
    const heading = item.heading.trim();
    if (!heading) continue;
    const imageUrls = Array.isArray(item.imageUrls)
      ? item.imageUrls.filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean)
      : [];
    out.push({
      day: typeof item.day === "number" && item.day > 0 ? item.day : undefined,
      dateText: typeof item.dateText === "string" ? item.dateText.trim() : undefined,
      dayTitle: typeof item.dayTitle === "string" ? item.dayTitle.trim() : undefined,
      heading,
      description: item.description.trim(),
      imageUrls,
      kind: item.kind,
      timeText: typeof item.timeText === "string" ? item.timeText.trim() : undefined,
      timeOfDay:
        item.timeOfDay === "오전" ||
        item.timeOfDay === "오후" ||
        item.timeOfDay === "저녁" ||
        item.timeOfDay === "종일"
          ? item.timeOfDay
          : undefined,
      displayRole:
        item.displayRole === "summary" || item.displayRole === "activity"
          ? item.displayRole
          : undefined,
    });
  }
  return out;
}
