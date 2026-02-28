/**
 * 스토리지 업로드 추상화 인터페이스
 * 향후 R2/S3 등으로 교체 가능
 */
export interface IStorageProvider {
  /**
   * 이미지 업로드 후 public URL 및 저장 경로 반환
   * @param file 업로드할 파일 (Blob | File)
   * @param path 저장 경로 (예: public/1234567890-abc123.webp)
   * @param contentType MIME 타입 (예: image/webp)
   * @param bucket 기본 product-images. PDF 등 다른 타입은 bucket 지정
   */
  uploadPublicImage(params: {
    file: Blob | File;
    path: string;
    contentType: string;
    bucket?: string;
  }): Promise<{ url: string; path: string }>;
}
