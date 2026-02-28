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
