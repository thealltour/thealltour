"use client";

/**
 * PDF 1페이지를 WebP 썸네일로 렌더링 (클라이언트 전용)
 * - pdfjs-dist 사용
 * - max width 800, webp quality 0.8
 *
 * 주의: 이 모듈은 브라우저에서만 동작합니다. (canvas, document 사용)
 */

const MAX_WIDTH = 800;
const WEBP_QUALITY = 0.8;

export type RenderFirstPageResult = {
  thumbFile: File;
  meta: { width: number; height: number; bytes: number };
};

let workerInitialized = false;

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerInitialized && typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    workerInitialized = true;
  }
  return pdfjsLib;
}

/**
 * PDF 파일의 1페이지를 WebP 이미지로 렌더링
 * @param pdfFile PDF 파일
 * @returns 썸네일 File과 meta 정보
 */
export async function renderFirstPageToWebp(pdfFile: File): Promise<RenderFirstPageResult> {
  if (typeof window === "undefined") {
    throw new Error("renderFirstPageToWebp는 브라우저 환경에서만 사용할 수 있습니다.");
  }
  if (pdfFile.type !== "application/pdf") {
    throw new Error("PDF 형식의 파일만 처리할 수 있습니다.");
  }

  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale =
    viewport.width >= viewport.height
      ? MAX_WIDTH / viewport.width
      : MAX_WIDTH / viewport.height;
  const scaledViewport = page.getViewport({ scale });
  const width = Math.round(scaledViewport.width);
  const height = Math.round(scaledViewport.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas를 사용할 수 없습니다.");
  }
  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas,
  }).promise;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      "image/webp",
      WEBP_QUALITY
    );
  });

  if (!blob) {
    throw new Error("WebP 변환에 실패했습니다.");
  }

  const baseName = (pdfFile.name || "guide").replace(/\.pdf$/i, "");
  const thumbFile = new File([blob], `${baseName}-thumb.webp`, { type: "image/webp" });

  return {
    thumbFile,
    meta: { width, height, bytes: thumbFile.size },
  };
}

/** PDF 1페이지를 이미지 data URL로 렌더링 (크롭 UI용) */
export async function renderFirstPageToDataUrl(
  pdfFile: File,
  maxWidth = 800
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (typeof window === "undefined") {
    throw new Error("renderFirstPageToDataUrl는 브라우저 환경에서만 사용할 수 있습니다.");
  }
  if (pdfFile.type !== "application/pdf") {
    throw new Error("PDF 형식의 파일만 처리할 수 있습니다.");
  }

  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale =
    viewport.width >= viewport.height ? maxWidth / viewport.width : maxWidth / viewport.height;
  const scaledViewport = page.getViewport({ scale });
  const width = Math.round(scaledViewport.width);
  const height = Math.round(scaledViewport.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");
  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas,
  }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  return { dataUrl, width, height };
}

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * PDF 1페이지에서 지정 영역을 잘라 WebP 썸네일 생성
 * @param pdfFile PDF 파일
 * @param cropRect 픽셀 좌표 (renderFirstPageToDataUrl과 동일한 scale 기준)
 */
export async function cropFirstPageToWebp(
  pdfFile: File,
  cropRect: CropRect,
  maxSourceWidth = 800
): Promise<{ thumbFile: File; meta: { width: number; height: number; bytes: number } }> {
  if (typeof window === "undefined") {
    throw new Error("cropFirstPageToWebp는 브라우저 환경에서만 사용할 수 있습니다.");
  }

  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale =
    viewport.width >= viewport.height ? maxSourceWidth / viewport.width : maxSourceWidth / viewport.height;
  const scaledViewport = page.getViewport({ scale });
  const srcWidth = Math.round(scaledViewport.width);
  const srcHeight = Math.round(scaledViewport.height);

  const canvas = document.createElement("canvas");
  canvas.width = srcWidth;
  canvas.height = srcHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");
  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas,
  }).promise;

  const x = Math.round(cropRect.x);
  const y = Math.round(cropRect.y);
  const w = Math.round(cropRect.width);
  const h = Math.round(cropRect.height);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = w;
  cropCanvas.height = h;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Canvas를 사용할 수 없습니다.");
  cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    cropCanvas.toBlob((b) => resolve(b), "image/webp", WEBP_QUALITY);
  });
  if (!blob) throw new Error("WebP 변환에 실패했습니다.");

  const baseName = (pdfFile.name || "guide").replace(/\.pdf$/i, "");
  const thumbFile = new File([blob], `${baseName}-thumb.webp`, { type: "image/webp" });

  return {
    thumbFile,
    meta: { width: w, height: h, bytes: thumbFile.size },
  };
}
