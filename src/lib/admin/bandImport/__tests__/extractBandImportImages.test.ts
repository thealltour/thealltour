import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractBandImportImages, BandImportImageError } from "@/lib/admin/bandImport/extractBandImportImages";
import { detectImageMime } from "@/lib/admin/bandImport/bandImportImageConstants";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function zipWithFiles(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) {
    zip.file(name, data);
  }
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("extractBandImportImages", () => {
  it("extracts jpg/png from zip and ignores other extensions", async () => {
    const zipBytes = await zipWithFiles({
      "photo.jpg": TINY_PNG,
      "notes.txt": "hello",
      "folder/inner.png": TINY_PNG,
      "readme.md": "# hi",
      "__MACOSX/._photo.jpg": TINY_PNG,
    });

    const images = await extractBandImportImages([{ name: "blog.zip", bytes: zipBytes }]);
    expect(images.map((img) => img.filename).sort()).toEqual(["inner.png", "photo.jpg"]);
    expect(images.every((img) => img.bytes.length > 0)).toBe(true);
  });

  it("extracts images that live only inside a nested folder", async () => {
    const zipBytes = await zipWithFiles({
      "여행사진/커버.jpg": TINY_PNG,
      "여행사진/갤러리/코스.png": TINY_PNG,
    });

    const images = await extractBandImportImages([{ name: "nested.zip", bytes: zipBytes }]);
    expect(images.map((img) => img.filename).sort()).toEqual(["커버.jpg", "코스.png"]);
  });

  it("extracts images from a zip nested inside the uploaded zip", async () => {
    const inner = await zipWithFiles({ "nested/shot.jpg": TINY_PNG });
    const outer = await zipWithFiles({ "bundle.zip": inner, "root.png": TINY_PNG });

    const images = await extractBandImportImages([{ name: "outer.zip", bytes: outer }]);
    expect(images.map((img) => img.filename).sort()).toEqual(["root.png", "shot.jpg"]);
  });

  it("throws a clear error when zip has no supported images", async () => {
    const zipBytes = await zipWithFiles({ "notes.txt": "hello", "folder/readme.md": "# hi" });
    await expect(
      extractBandImportImages([{ name: "empty.zip", bytes: zipBytes }]),
    ).rejects.toBeInstanceOf(BandImportImageError);
  });

  it("accepts standalone webp/jpeg files", async () => {
    const images = await extractBandImportImages([
      { name: "a.jpeg", bytes: TINY_PNG },
      { name: "b.webp", bytes: TINY_PNG },
    ]);
    expect(images).toHaveLength(2);
    expect(images[0].contentType).toBe("image/jpeg");
    expect(images[1].contentType).toBe("image/webp");
  });

  it("rejects standalone non-image files", async () => {
    await expect(
      extractBandImportImages([{ name: "notes.txt", bytes: Buffer.from("hi") }]),
    ).rejects.toBeInstanceOf(BandImportImageError);
  });
});

describe("detectImageMime", () => {
  it("reads jpeg/png/webp magic bytes", () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectImageMime(TINY_PNG)).toBe("image/png");
    expect(
      detectImageMime(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp");
    expect(detectImageMime(Buffer.from("hello"))).toBeNull();
  });
});
