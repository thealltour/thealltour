import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock("@/lib/admin/ai/importAiModel", () => ({
  resolveImportLanguageModel: () => "mock-model",
}));

import {
  buildBandImageVisionCatalog,
  classifyBandImportImages,
} from "@/lib/admin/bandImport/classifyBandImportImages";
import type { ItineraryV2 } from "@/types/product";

const itinerary: ItineraryV2 = {
  days: [
    {
      day: 1,
      title: "연태 도착",
      events: [
        { heading: "18홀 라운드", displayRole: "activity" },
        { heading: "숙소", displayRole: "summary" },
      ],
    },
  ],
};

describe("classifyBandImportImages", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("builds a catalog of day and event headings", () => {
    const catalog = buildBandImageVisionCatalog(itinerary);
    expect(catalog).toContain("Day 1: 연태 도착");
    expect(catalog).toContain("18홀 라운드");
    expect(catalog).toContain("숙소 [summary]");
  });

  it("returns vision assignments from generateObject", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        assignments: [
          { index: 0, role: "hero", day: null, eventHeading: null },
          { index: 1, role: "skip", day: null, eventHeading: null },
        ],
      },
    });

    const result = await classifyBandImportImages({
      itinerary,
      images: [
        { bytes: Buffer.from("a"), contentType: "image/jpeg", filename: "a.jpg" },
        { bytes: Buffer.from("b"), contentType: "image/png", filename: "b.png" },
      ],
    });

    expect(result[0]).toMatchObject({ index: 0, role: "hero" });
    expect(result[1]).toMatchObject({ index: 1, role: "skip" });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0] as {
      messages: Array<{ content: Array<{ type: string }> }>;
    };
    const types = call.messages[0].content.map((part) => part.type);
    expect(types.filter((t) => t === "image")).toHaveLength(2);
  });
});
