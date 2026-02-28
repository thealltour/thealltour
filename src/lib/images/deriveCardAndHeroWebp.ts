/**
 * 원본 이미지에서 card/hero 2종 WebP 생성
 * - hero: max-width 1920, webp, quality 0.8
 * - card: max-width 800, webp, quality 0.8
 * - canvas 사용, 비율 유지
 */

const HERO_MAX_WIDTH = 1920;
const CARD_MAX_WIDTH = 800;
const WEBP_QUALITY = 0.8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type DeriveCardAndHeroResult = {
  hero: File;
  card: File;
  meta: {
    originalBytes: number;
    heroBytes: number;
    cardBytes: number;
    width: number;
    height: number;
  };
  warnings?: string[];
};

function getBaseName(file: File): string {
  const name = file.name || "image";
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

function resizeToWebP(
  file: File,
  maxWidth: number
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth || height > maxWidth) {
        if (width >= height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
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
            resolve({ blob, width, height });
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

/**
 * 원본 File에서 hero/card 2종 WebP File 생성
 * @param file 원본 이미지 (jpg/jpeg/png/webp)
 * @returns hero, card File과 meta 정보. card 생성 실패 시 hero를 card로 fallback
 */
export async function deriveCardAndHeroWebp(
  file: File
): Promise<DeriveCardAndHeroResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("PNG, JPEG, WebP 형식만 업로드할 수 있습니다.");
  }

  const originalBytes = file.size;
  const baseName = getBaseName(file);
  const warnings: string[] = [];

  // hero 생성 (필수, 실패 시 throw)
  const heroResult = await resizeToWebP(file, HERO_MAX_WIDTH);
  const heroFile = new File([heroResult.blob], `${baseName}-hero.webp`, {
    type: "image/webp",
  });
  const heroBytes = heroFile.size;

  // card 생성 (실패 시 hero로 fallback)
  let cardFile: File;
  let cardBytes: number;
  try {
    const cardResult = await resizeToWebP(file, CARD_MAX_WIDTH);
    cardFile = new File([cardResult.blob], `${baseName}-card.webp`, {
      type: "image/webp",
    });
    cardBytes = cardFile.size;
  } catch (cardErr) {
    cardFile = new File([heroResult.blob], `${baseName}-card.webp`, {
      type: "image/webp",
    });
    cardBytes = cardFile.size;
    warnings.push(
      `카드용 변환 실패, 히어로 이미지를 사용합니다: ${cardErr instanceof Error ? cardErr.message : "알 수 없는 오류"}`
    );
  }

  return {
    hero: heroFile,
    card: cardFile,
    meta: {
      originalBytes,
      heroBytes,
      cardBytes,
      width: heroResult.width,
      height: heroResult.height,
    },
    ...(warnings.length > 0 && { warnings }),
  };
}
