import { describe, expect, it } from "vitest";
import {
  attachBandVenueImages,
  parseBandVenueImagePaths,
  parseBandVenueRows,
} from "@/lib/admin/bandImport/bandVenueImages";

describe("parseBandVenueRows", () => {
  it("keeps empty rows so photo indexes stay aligned", () => {
    expect(
      parseBandVenueRows(JSON.stringify([{ name: " A GC ", content: " 설명 " }, { name: "", content: "" }, null])),
    ).toEqual([
      { name: "A GC", content: "설명" },
      { name: "", content: "" },
      { name: "", content: "" },
    ]);
  });

  it("accepts arrays and ignores invalid JSON", () => {
    expect(parseBandVenueRows([{ name: "호텔", content: 3 }])).toEqual([{ name: "호텔", content: "" }]);
    expect(parseBandVenueRows("{oops")).toEqual([]);
    expect(parseBandVenueRows("")).toEqual([]);
  });
});

describe("parseBandVenueImagePaths", () => {
  it("parses valid groups and drops malformed ones", () => {
    const raw = JSON.stringify([
      { kind: "golf", index: 0, paths: [{ path: "staging/a.jpg", filename: "a.jpg" }] },
      { kind: "hotel", index: 1, paths: [{ path: "staging/b.jpg" }, { path: "" }] },
      { kind: "attraction", index: 0, paths: [{ path: "staging/e.jpg" }] },
      { kind: "spa", index: 0, paths: [{ path: "staging/c.jpg" }] },
      { kind: "golf", index: -1, paths: [{ path: "staging/d.jpg" }] },
      { kind: "golf", index: 2, paths: [] },
    ]);
    expect(parseBandVenueImagePaths(raw)).toEqual([
      { kind: "golf", index: 0, paths: [{ path: "staging/a.jpg", filename: "a.jpg" }] },
      { kind: "hotel", index: 1, paths: [{ path: "staging/b.jpg", filename: undefined }] },
      { kind: "attraction", index: 0, paths: [{ path: "staging/e.jpg", filename: undefined }] },
    ]);
  });

  it("returns empty for invalid input", () => {
    expect(parseBandVenueImagePaths("")).toEqual([]);
    expect(parseBandVenueImagePaths("not json")).toEqual([]);
    expect(parseBandVenueImagePaths("{}")).toEqual([]);
  });
});

describe("attachBandVenueImages", () => {
  it("adds uploaded URLs by row index", () => {
    const rows = [
      { name: "A", content: "" },
      { name: "B", content: "설명" },
    ];
    expect(attachBandVenueImages(rows, new Map([[0, ["https://cdn/a.webp"]]]))).toEqual([
      { name: "A", content: "", images: ["https://cdn/a.webp"] },
      { name: "B", content: "설명" },
    ]);
  });
});
