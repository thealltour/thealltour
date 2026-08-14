import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractBandImportImages, BandImportImageError } from "@/lib/admin/bandImport/extractBandImportImages";

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
