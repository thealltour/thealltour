import { toPng } from "html-to-image";

const DOCUMENT_SELECTOR = "[data-flyer-document]";
const LEGACY_PAPER_SELECTOR = "[data-flyer-paper]";

/** 이미지 임베딩 실패 시에도 clone 파이프라인이 reject 되지 않도록 1×1 투명 PNG */
const IMAGE_PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 파일명용: 공백·특수문자 정리 */
export function sanitizeFlyerPngFileName(rawTitle: string): string {
  const base = rawTitle
    .trim()
    .slice(0, 60)
    .replace(/[^\p{L}\p{N}\s\-_]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "product") + "-flyer.png";
}

type ToPngOpts = Parameters<typeof toPng>[1];

function buildOptions(pixelRatio: number): ToPngOpts {
  return {
    pixelRatio,
    backgroundColor: "#ffffff",
    /** Supabase 서명 URL, `/_next/image?...` 등 쿼리가 깨지면 페치 실패 → PNG 전체 실패 */
    cacheBust: false,
    /** 웹폰트 임베드 실패 시 전체 중단되는 경우 완화 */
    skipFonts: true,
    imagePlaceholder: IMAGE_PLACEHOLDER_PNG,
  };
}

/**
 * 롱포맷 문서 루트(`data-flyer-document`)를 우선 캡처해 PNG 다운로드.
 * `previewRoot`는 FlyerLongformPreview 최상위 루트(ref)를 넘긴다.
 */
export async function exportFlyerToPng(previewRoot: HTMLElement, fileName: string): Promise<void> {
  const doc =
    (previewRoot.querySelector(DOCUMENT_SELECTOR) as HTMLElement | null) ??
    (previewRoot.querySelector(LEGACY_PAPER_SELECTOR) as HTMLElement | null) ??
    previewRoot;

  const ratio = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 2;

  let dataUrl: string;
  try {
    dataUrl = await toPng(doc, buildOptions(ratio));
  } catch (first) {
    try {
      dataUrl = await toPng(doc, buildOptions(1));
    } catch {
      const detail = first instanceof Error ? first.message : String(first);
      throw new Error(
        `PNG로 저장하지 못했습니다. (${detail}) 이미지 로드 실패·문서가 너무 길거나 브라우저 보안 제한일 수 있습니다. 갤러리 장수를 줄이거나 잠시 후 다시 시도해 보세요.`,
      );
    }
  }

  try {
    triggerDownload(dataUrl, fileName);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`다운로드를 시작하지 못했습니다. (${detail})`);
  }
}
