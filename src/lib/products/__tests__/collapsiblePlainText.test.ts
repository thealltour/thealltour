import { describe, expect, it } from "vitest";
import {
  collapsedPreview,
  needsDescriptionCollapse,
  previewNoticeLines,
} from "@/lib/products/collapsiblePlainText";

describe("collapsiblePlainText", () => {
  it("uses 12 lines or 800 chars threshold", () => {
    expect(needsDescriptionCollapse("짧음")).toBe(false);
    expect(needsDescriptionCollapse(Array.from({ length: 13 }, (_, i) => `줄 ${i}`).join("\n"))).toBe(
      true,
    );
    expect(needsDescriptionCollapse("가".repeat(801))).toBe(true);
  });

  it("previewNoticeLines keeps line boundaries", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `notice line ${i + 1}`);
    const preview = previewNoticeLines(lines);
    expect(preview.hasMore).toBe(true);
    expect(preview.lines.length).toBeLessThanOrEqual(12);
    expect(preview.lines[0]).toBe("notice line 1");
  });

  it("collapsedPreview does not mutate beyond trimEnd", () => {
    const text = Array.from({ length: 20 }, (_, i) => `줄 ${i + 1}`).join("\n");
    const clipped = collapsedPreview(text);
    expect(text.startsWith(clipped)).toBe(true);
  });
});
