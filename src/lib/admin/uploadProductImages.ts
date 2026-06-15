import { deriveCardAndHeroWebp } from "@/lib/images/deriveCardAndHeroWebp";

const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|png|webp)$/i;

export type UploadProductImageFilesOptions = {
  maxCount?: number;
  existingCount?: number;
};

export type UploadProductImageFilesResult = {
  urls: string[];
  skippedInvalidType: number;
  skippedOverLimit: number;
};

/**
 * 상품·일정 이미지 공통 업로드 (hero webp → POST /api/admin/uploads/image).
 */
export async function uploadProductImageFiles(
  files: FileList | File[],
  options: UploadProductImageFilesOptions = {},
): Promise<UploadProductImageFilesResult> {
  const maxCount = options.maxCount ?? 10;
  const existingCount = options.existingCount ?? 0;
  const all = Array.from(files);
  const valid = all.filter((f) => ALLOWED_IMAGE_TYPES.test(f.type));
  const skippedInvalidType = all.length - valid.length;

  const remain = maxCount - existingCount;
  if (remain <= 0) {
    return { urls: [], skippedInvalidType, skippedOverLimit: valid.length };
  }

  const targets = valid.slice(0, remain);
  const skippedOverLimit = valid.length - targets.length;
  const urls: string[] = [];

  for (const file of targets) {
    const { hero } = await deriveCardAndHeroWebp(file);
    const formData = new FormData();
    formData.append("hero", hero, hero.name);
    const res = await fetch("/api/admin/uploads/image", { method: "POST", body: formData });
    let data: { heroUrl?: string; url?: string; error?: string } = {};
    try {
      data = (await res.json()) as { heroUrl?: string; url?: string; error?: string };
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error ?? "업로드 실패");
    }
    const url = data.heroUrl ?? data.url;
    if (typeof url === "string" && url.trim()) {
      urls.push(url.trim());
    }
  }

  return { urls, skippedInvalidType, skippedOverLimit };
}
