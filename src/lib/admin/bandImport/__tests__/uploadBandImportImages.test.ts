import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const convertToWebpMock = vi.fn();

vi.mock("@/lib/images/convertImage", () => ({
  convertToWebp: (...args: unknown[]) => convertToWebpMock(...args),
}));

import { uploadBandImportImages } from "@/lib/admin/bandImport/uploadBandImportImages";
import type { IStorageProvider } from "@/lib/storage";

function mockProvider() {
  const uploadPublicImage = vi.fn(async (params: { path: string; contentType: string }) => ({
    url: `https://cdn.example/${params.path}`,
    path: params.path,
  }));
  return {
    provider: { uploadPublicImage } as unknown as IStorageProvider,
    uploadPublicImage,
  };
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const WEBP_MAGIC = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("uploadBandImportImages", () => {
  beforeEach(() => {
    convertToWebpMock.mockReset();
  });

  it("converts PNG to WebP before upload", async () => {
    const pngBytes = Buffer.from("fake-png");
    const webpBytes = Buffer.from("converted-webp");
    convertToWebpMock.mockResolvedValue(webpBytes);
    const { provider, uploadPublicImage } = mockProvider();

    const { uploaded } = await uploadBandImportImages(
      [{ filename: "hero.png", bytes: pngBytes, contentType: "image/png" }],
      provider,
    );

    expect(convertToWebpMock).toHaveBeenCalledWith(pngBytes);
    expect(uploadPublicImage).toHaveBeenCalledTimes(1);
    const call = uploadPublicImage.mock.calls[0][0];
    expect(call.contentType).toBe("image/webp");
    expect(call.path).toMatch(/\.webp$/);
    expect(Buffer.isBuffer(call.file)).toBe(true);
    expect(uploaded[0]).toMatchObject({
      filename: "hero.png",
      contentType: "image/webp",
      bytes: webpBytes,
    });
  });

  it("converts jpeg to webp and passes through webp", async () => {
    const { provider, uploadPublicImage } = mockProvider();
    const converted = Buffer.from("from-jpeg");
    convertToWebpMock.mockResolvedValue(converted);

    await uploadBandImportImages(
      [
        { filename: "a.jpeg", bytes: JPEG_MAGIC, contentType: "image/jpeg" },
        { filename: "b.webp", bytes: WEBP_MAGIC, contentType: "image/webp" },
      ],
      provider,
    );

    expect(convertToWebpMock).toHaveBeenCalledTimes(1);
    expect(convertToWebpMock).toHaveBeenCalledWith(JPEG_MAGIC);
    expect(uploadPublicImage.mock.calls[0][0].contentType).toBe("image/webp");
    expect(uploadPublicImage.mock.calls[0][0].path).toMatch(/\.webp$/);
    expect(uploadPublicImage.mock.calls[1][0].contentType).toBe("image/webp");
    expect(uploadPublicImage.mock.calls[1][0].file).toBe(WEBP_MAGIC);
  });

  it("skips a file when WebP conversion fails instead of aborting the batch", async () => {
    convertToWebpMock.mockResolvedValueOnce(null).mockResolvedValueOnce(Buffer.from("ok-webp"));
    const { provider, uploadPublicImage } = mockProvider();

    const { uploaded, errors } = await uploadBandImportImages(
      [
        { filename: "broken.png", bytes: Buffer.from("x"), contentType: "image/png" },
        { filename: "ok.jpg", bytes: JPEG_MAGIC, contentType: "image/jpeg" },
      ],
      provider,
    );

    expect(errors[0]).toContain("broken.png");
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].filename).toBe("ok.jpg");
    expect(uploadPublicImage).toHaveBeenCalledTimes(1);
  });
});
