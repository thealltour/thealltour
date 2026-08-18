import { describe, expect, it } from "vitest";
import { normalizeGolfCoursesJson } from "@/lib/admin/golfCourses";

describe("normalizeGolfCoursesJson", () => {
  it("filters out empty rows", () => {
    expect(
      normalizeGolfCoursesJson([
        { name: "수트라하버 GC", content: "설명" },
        { name: "  ", content: "내용만 있음" },
        { name: "이름만 있음", content: "   " },
      ]),
    ).toEqual([{ name: "수트라하버 GC", content: "설명" }]);
  });

  it("returns null when no valid rows", () => {
    expect(normalizeGolfCoursesJson(null)).toBeNull();
    expect(normalizeGolfCoursesJson([{ name: "", content: "" }])).toBeNull();
  });
});
