"use client";

import JSZip from "jszip";
import type { Product } from "@/types/product";
import {
  buildProductImageSlugPrefix,
  buildProductImageFilename,
  uniquifyZipEntryName,
} from "./buildProductImageFilename";
import { collectProductImageEntries } from "./collectProductImageEntries";
import { clampJpegExportQuality, convertImageToBlob } from "./convertImageToBlob";
import type { DownloadProductImagesAsZipOptions, ImageOutputFormat } from "./imageDownload.types";
import type { ProductImageZipDownloadResult } from "./imageDownloadProgress.types";

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * 상품 이미지를 순차 변환해 ZIP 1개로 내려받습니다. (브라우저 전용)
 * 개별 이미지 실패 시 로그만 남기고 계속 진행합니다. 성공한 이미지가 0장이면 ZIP을 만들지 않습니다.
 */
export async function downloadProductImagesAsZip(
  product: Product,
  options?: DownloadProductImagesAsZipOptions,
): Promise<ProductImageZipDownloadResult> {
  const format: ImageOutputFormat = options?.format ?? "png";
  const quality =
    format === "jpg" ? clampJpegExportQuality(options?.quality) : undefined;
  const namingMode = options?.namingMode ?? "detailed";
  const onProgress = options?.onProgress;
  const productId = product.id;

  const emptyResult: ProductImageZipDownloadResult = {
    total: 0,
    successCount: 0,
    failedCount: 0,
    zipFileName: "",
  };

  onProgress?.({
    productId,
    stage: "collecting",
    total: 0,
    completed: 0,
    failed: 0,
    message: "이미지 목록을 수집하는 중입니다.",
  });

  const entries =
    options?.entries !== undefined
      ? options.entries
      : collectProductImageEntries(product);

  if (entries.length === 0) {
    onProgress?.({
      productId,
      stage: "error",
      total: 0,
      completed: 0,
      failed: 0,
      message: "다운로드할 이미지가 없습니다.",
    });
    return emptyResult;
  }

  const total = entries.length;
  onProgress?.({
    productId,
    stage: "converting",
    total,
    completed: 0,
    failed: 0,
    message: `총 ${total}장의 이미지를 준비했습니다.`,
  });

  const zip = new JSZip();
  const usedNames = new Set<string>();
  let completed = 0;
  let failed = 0;
  let simpleOtherIdx = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const simpleOtherIndex =
      namingMode === "simple" &&
      entry.source !== "cover" &&
      entry.source !== "gallery"
        ? ++simpleOtherIdx
        : undefined;
    const baseName = buildProductImageFilename(product, entry, {
      format,
      namingMode,
      simpleOtherIndex,
    });

    onProgress?.({
      productId,
      stage: "converting",
      total,
      completed,
      failed,
      currentFileName: baseName,
      currentSource: entry.source,
      message: `${completed + failed + 1}/${total} 이미지 처리 중`,
    });

    try {
      const blob = await convertImageToBlob(entry.url, {
        format,
        ...(format === "jpg" ? { quality } : {}),
      });
      const filename = uniquifyZipEntryName(usedNames, baseName);
      zip.file(filename, blob);
      completed++;
    } catch (e) {
      console.error("[IMAGE_ZIP][image]", entry.url, e);
      failed++;
    }

    onProgress?.({
      productId,
      stage: "converting",
      total,
      completed,
      failed,
      currentFileName: baseName,
      currentSource: entry.source,
      message: `${completed + failed}/${total} 처리됨`,
    });
  }

  if (completed === 0) {
    onProgress?.({
      productId,
      stage: "error",
      total,
      completed: 0,
      failed,
      message: "변환에 성공한 이미지가 없습니다.",
    });
    throw new Error("ALL_IMAGES_FAILED");
  }

  onProgress?.({
    productId,
    stage: "zipping",
    total,
    completed,
    failed,
    message: "ZIP 파일을 만드는 중입니다.",
  });

  let zipBlob: Blob;
  try {
    zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } catch (e) {
    console.error("[IMAGE_ZIP][zip]", e);
    onProgress?.({
      productId,
      stage: "error",
      total,
      completed,
      failed,
      message: "ZIP 파일 생성에 실패했습니다.",
    });
    throw e instanceof Error ? e : new Error(String(e));
  }

  const slug = buildProductImageSlugPrefix(product);
  const zipFilename = options?.zipName?.trim() || `${slug}__images.zip`;
  const finalZipName = zipFilename.endsWith(".zip") ? zipFilename : `${zipFilename}.zip`;

  onProgress?.({
    productId,
    stage: "downloading",
    total,
    completed,
    failed,
    message: "다운로드를 시작하는 중입니다.",
  });

  try {
    triggerBlobDownload(zipBlob, finalZipName);
  } catch (e) {
    console.error("[IMAGE_ZIP][download]", e);
    onProgress?.({
      productId,
      stage: "error",
      total,
      completed,
      failed,
      message: "브라우저 다운로드를 시작하지 못했습니다.",
    });
    throw e instanceof Error ? e : new Error(String(e));
  }

  onProgress?.({
    productId,
    stage: "done",
    total,
    completed,
    failed,
    message: "다운로드 준비가 완료되었습니다.",
  });

  return {
    total,
    successCount: completed,
    failedCount: failed,
    zipFileName: finalZipName,
  };
}
