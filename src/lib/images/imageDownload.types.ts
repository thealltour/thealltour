import type { ProductImageDownloadProgressCallback } from "./imageDownloadProgress.types";

export type ImageOutputFormat = "png" | "jpg";

/** ZIP 내부 파일명: `detailed`는 일차·이벤트·출처 포함, `simple`은 cover/gallery/image 순번만 */
export type ImageFileNamingMode = "simple" | "detailed";

export type DownloadProductImagesOptions = {
  format?: ImageOutputFormat;
  /** JPG 전용. 미지정 시 0.92, 적용 시 0.1~1.0 clamp */
  quality?: number;
  /** 이미지 1장당 최대 바이트 수. 초과 시 자동 압축/리사이즈 시도 */
  maxBytesPerImage?: number;
  zipName?: string;
  /** 기본 `detailed` */
  namingMode?: ImageFileNamingMode;
};

export type ConvertImageToBlobOptions = {
  format?: ImageOutputFormat;
  quality?: number;
  /** 이미지 1장당 최대 바이트 수. 초과 시 자동 압축/리사이즈 시도 */
  maxBytesPerImage?: number;
  /** JPG 합성 시 알파 제거용 배경 (기본 흰색) */
  backgroundColor?: string;
};

export type ProductImageEntrySource =
  | "cover"
  | "gallery"
  | "itinerary-media"
  | "structured-day-cover"
  | "structured-event-image"
  | "v2-day-cover"
  | "v2-event-image";

export type ProductImageEntry = {
  /** 선택 UI·부분 ZIP용 안정 식별자 (source·일차·이벤트·인덱스 기반) */
  id: string;
  url: string;
  source: ProductImageEntrySource;
  /** 수집 순서(같은 source 내 보조 인덱스 등) */
  index: number;
  dayNumber?: number;
  eventIndex?: number;
  /** 이벤트 내 이미지 순번 (1-based, 파일명 II용) */
  imageIndexInEvent?: number;
  eventHeading?: string;
};

export type DownloadProductImagesAsZipOptions = DownloadProductImagesOptions & {
  /** 지정 시 해당 목록만 ZIP에 포함 (미지정 시 상품에서 전체 수집) */
  entries?: ProductImageEntry[];
  onProgress?: ProductImageDownloadProgressCallback;
};
