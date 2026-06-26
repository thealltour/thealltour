/**
 * 상품 이미지 URL 정규화
 *
 * - 모두투어(img.modetour.com) 썸네일 URL: resize_w=157 등 리사이즈 쿼리 제거 → 고해상도 원본 요청
 * - Supabase storage: 옵션 시 render URL 변환
 */
type ImageTransformOptions = {
  width?: number;
  quality?: number;
  mode?: "cover" | "contain" | "fill";
};

import { upgradeHanatourImageUrl } from "@/lib/images/upgradeHanatourImageUrl";

/** 모두투어 CDN 썸네일 URL을 고해상도 URL로 변환 (resize_w/resize_h 등 제거). */
function toModetourHighResUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() !== "img.modetour.com") return url;
    const drop = new Set([
      "resize", "resize_w", "resize_h", "w", "h", "width", "height",
      "utm_source", "utm_medium", "utm_campaign", "cache", "v", "ver", "t", "timestamp", "quality",
    ]);
    let changed = false;
    u.searchParams.forEach((_, k) => {
      const low = k.toLowerCase();
      if (drop.has(low) || /^_\d+$/.test(low)) {
        u.searchParams.delete(k);
        changed = true;
      }
    });
    return changed ? u.href : url;
  } catch {
    return url;
  }
}

/** Supabase render/image URL이면 원본 object/public URL로 되돌림 (다운로드/원본 노출용). */
function toSupabaseOriginalObjectUrl(url: string): string {
  const trimmed = url.trim();
  const match = trimmed.match(
    /^(https?:\/\/[^/]+)\/storage\/v1\/render\/image\/public\/([^/]+)\/([^?]+)(?:\?.*)?$/,
  );
  if (!match) return url;
  const [, host, bucket, objectPath] = match;
  return `${host}/storage/v1/object/public/${bucket}/${objectPath}`;
}

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
  let normalized = upgradeHanatourImageUrl(url.trim());
  normalized = toSupabaseOriginalObjectUrl(normalized);
  normalized = toModetourHighResUrl(normalized);
  return toSupabaseRenderUrl(normalized, options);
}
