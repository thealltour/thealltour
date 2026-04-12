export type ProductImageDownloadStage =
  | "idle"
  | "collecting"
  | "converting"
  | "zipping"
  | "downloading"
  | "done"
  | "error";

export type ProductImageDownloadProgress = {
  productId: string;
  stage: ProductImageDownloadStage;
  total: number;
  completed: number;
  failed: number;
  currentFileName?: string;
  currentSource?: string;
  message?: string;
};

export type ProductImageDownloadProgressCallback = (progress: ProductImageDownloadProgress) => void;

/** `downloadProductImagesAsZip` 완료 시 반환 */
export type ProductImageZipDownloadResult = {
  total: number;
  successCount: number;
  failedCount: number;
  zipFileName: string;
};
