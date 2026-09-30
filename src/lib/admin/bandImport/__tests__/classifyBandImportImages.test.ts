import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock("@/lib/admin/ai/importAiModel", () => ({
  resolveImportLanguageModel: () => "mock-model",
  withGoogleModelFallback: async (
    _label: string,
    run: (model: string) => Promise<unknown>,
  ) => run("mock-model"),
}));

import { classifyBandImportImages } from "@/lib/admin/bandImport/classifyBandImportImages";

describe("classifyBandImportImages", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("returns vision assignments and sends every image", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        assignments: [
          { index: 0, role: "hero" },
          { index: 1, role: "skip" },
        ],
      },
    });

    const result = await classifyBandImportImages({
      images: [
        { bytes: Buffer.from("a"), contentType: "image/jpeg", filename: "a.jpg" },
        { bytes: Buffer.from("b"), contentType: "image/png", filename: "b.png" },
      ],
    });

    expect(result[0]).toMatchObject({ index: 0, role: "hero" });
    expect(result[1]).toMatchObject({ index: 1, role: "skip" });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0] as {
      system: string;
      messages: Array<{ content: Array<{ type: string }> }>;
    };
    const types = call.messages[0].content.map((part) => part.type);
    expect(types.filter((t) => t === "image")).toHaveLength(2);
    expect(call.system).toContain("gallery");
    expect(call.system).not.toMatch(/dayCover|eventHeading/);
  });

  it("skips the model call when there are no images", async () => {
    const result = await classifyBandImportImages({ images: [] });
    expect(result).toEqual([]);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});
