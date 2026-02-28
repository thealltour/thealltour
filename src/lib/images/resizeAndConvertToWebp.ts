/**
 * 클라이언트 이미지 리사이즈 + WebP 변환
 * - 최대 가로 1920px
 * - canvas 사용
 * - WebP 품질 0.8
 */

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ResizeResult {
  blob: Blob;
  originalSize: number;
  convertedSize: number;
}

/**
 * 이미지를 리사이즈하고 WebP로 변환
 * @param file PNG/JPEG/WebP 파일
 * @returns 변환된 Blob과 변환 전/후 파일 크기
 */
export async function resizeAndConvertToWebP(file: File): Promise<ResizeResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("PNG, JPEG, WebP 형식만 업로드할 수 있습니다.");
  }

  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_WIDTH) {
        if (width >= height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_WIDTH) / height);
          height = MAX_WIDTH;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas를 사용할 수 없습니다."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              originalSize,
              convertedSize: blob.size,
            });
          } else {
            reject(new Error("WebP 변환에 실패했습니다."));
          }
        },
        "image/webp",
        WEBP_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };

    img.src = url;
  });
}
