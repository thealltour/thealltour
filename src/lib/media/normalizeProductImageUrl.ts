/**
 * 상품 이미지 URL 정규화
 *
 * 현재: 입력 URL 그대로 반환
 * 향후: /media/products/... 프록시 도입 시 이 함수만 수정
 */
type ImageTransformOptions = {
  width?: number;
  quality?: number;
  mode?: "cover" | "contain" | "fill";
};

function toSupabaseRenderUrl(url: string, options?: ImageTransformOptions): string {
  const enableRender = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RENDER === "true";
  if (!enableRender) return url;
  if (!options?.width) return url;
  const match = url.match(
    /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  );
  if (!match) return url;

  const [, host, bucket, objectPath] = match;
  const base = `${host}/storage/v1/render/image/public/${bucket}/${objectPath}`;
  const params = new URLSearchParams();
  params.set("width", String(Math.max(1, Math.floor(options.width))));
  if (typeof options.quality === "number") {
    params.set("quality", String(Math.max(20, Math.min(100, Math.floor(options.quality)))));
  }
  if (options.mode) {
    params.set("resize", options.mode);
  }
  return `${base}?${params.toString()}`;
}

export function normalizeProductImageUrl(
  url: string | null | undefined,
  options?: ImageTransformOptions,
): string {
  if (!url?.trim()) return "";
  const normalized = url.trim();
  return toSupabaseRenderUrl(normalized, options);
}
