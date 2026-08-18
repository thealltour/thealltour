import type { GolfCourseInfoItem } from "@/types/product";

type GolfCourseLike = {
  name?: unknown;
  content?: unknown;
};

/** 입력 배열/객체를 정규화해 유효한 골프장 항목만 남긴다. */
export function normalizeGolfCoursesJson(raw: unknown): GolfCourseInfoItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((item): item is GolfCourseLike => item != null && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      content: typeof item.content === "string" ? item.content.trim() : "",
    }))
    .filter((item) => item.name.length > 0 && item.content.length > 0);
  return items.length > 0 ? items : null;
}
