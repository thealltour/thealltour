import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const convertToJpgMock = vi.fn();

vi.mock("@/lib/images/convertImage", () => ({
  convertToJpg: (...args: unknown[]) => convertToJpgMock(...args),
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

describe("uploadBandImportImages", () => {
  beforeEach(() => {
    convertToJpgMock.mockReset();
  });

  it("converts PNG to JPEG before upload", async () => {
    const pngBytes = Buffer.from("fake-png");
    const jpgBytes = Buffer.from("converted-jpg");
    convertToJpgMock.mockResolvedValue(jpgBytes);
    const { provider, uploadPublicImage } = mockProvider();

    const result = await uploadBandImportImages(
      [{ filename: "hero.png", bytes: pngBytes, contentType: "image/png" }],
      provider,
    );

    expect(convertToJpgMock).toHaveBeenCalledWith(pngBytes);
    expect(uploadPublicImage).toHaveBeenCalledTimes(1);
    const call = uploadPublicImage.mock.calls[0][0];
    expect(call.contentType).toBe("image/jpeg");
    expect(call.path).toMatch(/\.jpg$/);
    expect(result[0]).toMatchObject({
      filename: "hero.png",
      contentType: "image/jpeg",
      bytes: jpgBytes,
    });
  });

  it("uploads jpeg and webp without conversion", async () => {
    const { provider, uploadPublicImage } = mockProvider();
    const jpegBytes = Buffer.from("jpeg");
    const webpBytes = Buffer.from("webp");

    await uploadBandImportImages(
      [
        { filename: "a.jpeg", bytes: jpegBytes, contentType: "image/jpeg" },
        { filename: "b.webp", bytes: webpBytes, contentType: "image/webp" },
      ],
      provider,
    );

    expect(convertToJpgMock).not.toHaveBeenCalled();
    expect(uploadPublicImage.mock.calls[0][0].contentType).toBe("image/jpeg");
    expect(uploadPublicImage.mock.calls[0][0].path).toMatch(/\.jpeg$/);
    expect(uploadPublicImage.mock.calls[1][0].contentType).toBe("image/webp");
    expect(uploadPublicImage.mock.calls[1][0].path).toMatch(/\.webp$/);
  });

  it("throws when PNG conversion fails", async () => {
    convertToJpgMock.mockResolvedValue(null);
    const { provider } = mockProvider();

    await expect(
      uploadBandImportImages(
        [{ filename: "broken.png", bytes: Buffer.from("x"), contentType: "image/png" }],
        provider,
      ),
    ).rejects.toThrow("PNG를 JPEG로 변환하지 못했습니다: broken.png");
  });
});
