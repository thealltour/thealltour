import { isFlyerImageProxyHostAllowed } from "@/lib/flyers/flyerImageProxyHosts";
import type { ConvertImageToBlobOptions, ImageOutputFormat } from "./imageDownload.types";

/** JPG `toBlob` 품질. 미지정 0.92, 범위 0.1~1.0 */
export function clampJpegExportQuality(quality?: number): number {
  const v = quality ?? 0.92;
  return Math.min(1, Math.max(0.1, v));
}

/**
 * 외부 이미지 URL은 CORS로 fetch가 막히는 경우가 많아,
 * `flyerImageProxyHosts`에 허용된 호스트는 동일 출처 `/api/flyers/image-proxy`를 경유합니다.
 */
function resolveImageFetchUrl(url: string): string {
  if (typeof window === "undefined") return url;
  let parsed: URL;
  try {
    parsed = new URL(url.trim(), window.location.href);
  } catch {
    return url;
  }
  if (parsed.origin === window.location.origin) {
    return parsed.href;
  }
  if (isFlyerImageProxyHostAllowed(parsed.hostname)) {
    const q = encodeURIComponent(parsed.href);
    return `${window.location.origin}/api/flyers/image-proxy?url=${q}`;
  }
  return parsed.href;
}

/**
 * 브라우저에서 이미지(URL)를 fetch 후 Canvas로 래스터화하여 Blob으로 만듭니다.
 * AVIF 등 decode 가능한 포맷은 createImageBitmap 경로로 처리됩니다.
 *
 * (서버용 JPG 변환은 `convertImage.ts`의 convertToJpg를 사용합니다.)
 */
export async function convertImageToBlob(
  url: string,
  options?: ConvertImageToBlobOptions,
): Promise<Blob> {
  const format: ImageOutputFormat = options?.format ?? "png";
  const quality = format === "jpg" ? clampJpegExportQuality(options?.quality) : undefined;
  const maxBytesPerImage =
    typeof options?.maxBytesPerImage === "number" && Number.isFinite(options.maxBytesPerImage)
      ? Math.max(1, Math.floor(options.maxBytesPerImage))
      : undefined;
  const backgroundColor = options?.backgroundColor ?? "#ffffff";

  const fetchUrl = resolveImageFetchUrl(url);

  let res: Response;
  try {
    res = await fetch(fetchUrl);
  } catch (e) {
    throw new Error(`fetch 네트워크 오류: ${url.slice(0, 96)} (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!res.ok) {
    throw new Error(`fetch 실패 ${res.status}: ${url.slice(0, 96)}`);
  }

  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    throw new Error(`blob 읽기 실패: ${url.slice(0, 96)}`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (e) {
    throw new Error(
      `createImageBitmap 실패: ${url.slice(0, 96)} (${e instanceof Error ? e.message : String(e)})`,
    );
  }

  try {
    const mime = format === "jpg" ? "image/jpeg" : "image/png";

    const renderBlob = async (targetWidth: number, targetHeight: number, targetQuality?: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas ctx 없음");

      if (format === "jpg") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error(`toBlob 결과 없음 (${mime}): ${url.slice(0, 96)}`));
              return;
            }
            resolve(b);
          },
          mime,
          targetQuality,
        );
      });
    };

    let currentWidth = bitmap.width;
    let currentHeight = bitmap.height;
    let currentQuality = quality;
    let rendered = await renderBlob(currentWidth, currentHeight, currentQuality);

    if (!maxBytesPerImage || rendered.size <= maxBytesPerImage) {
      return rendered;
    }

    for (let attempt = 0; attempt < 8 && rendered.size > maxBytesPerImage; attempt++) {
      let changed = false;

      if (format === "jpg" && typeof currentQuality === "number" && currentQuality > 0.62) {
        const nextQuality = Math.max(0.62, Number((currentQuality - 0.07).toFixed(2)));
        if (nextQuality < currentQuality) {
          currentQuality = nextQuality;
          changed = true;
        }
      }

      if (rendered.size > maxBytesPerImage && (currentWidth > 1 || currentHeight > 1)) {
        const ratio = Math.min(0.92, Math.max(0.6, Math.sqrt(maxBytesPerImage / rendered.size) * 0.98));
        const nextWidth = Math.max(1, Math.floor(currentWidth * ratio));
        const nextHeight = Math.max(1, Math.floor(currentHeight * ratio));
        if (nextWidth < currentWidth || nextHeight < currentHeight) {
          currentWidth = nextWidth;
          currentHeight = nextHeight;
          changed = true;
        }
      }

      if (!changed) break;

      const nextRendered = await renderBlob(currentWidth, currentHeight, currentQuality);
      if (nextRendered.size >= rendered.size && currentWidth <= 1 && currentHeight <= 1) {
        rendered = nextRendered;
        break;
      }
      rendered = nextRendered;
    }

    return rendered;
  } finally {
    bitmap.close();
  }
}
