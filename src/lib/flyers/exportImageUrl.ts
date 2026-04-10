const PROXY_PATH = "/api/flyers/image-proxy";

function flyerProxySrc(encodedQueryUrl: string): string {
  const path = `${PROXY_PATH}?url=${encodedQueryUrl}`;
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).href;
  }
  return path;
}

/**
 * PNG(html-to-image)용: 동일 출처 이미지에는 `crossOrigin`을 붙이지 않습니다.
 * CORS 모드로 로드한 뒤 API 응답에 ACAO가 없으면 캔버스에 그릴 수 없어 공유 페이지에서만 빈 PNG가 나올 수 있습니다.
 */
export function flyerExportImageCrossOrigin(src: string): "anonymous" | undefined {
  if (typeof window === "undefined") return undefined;
  const s = src?.trim() ?? "";
  if (!s || s.startsWith("data:") || s.startsWith("blob:")) return undefined;
  try {
    const resolved = new URL(s, window.location.origin);
    return resolved.origin === window.location.origin ? undefined : "anonymous";
  } catch {
    return "anonymous";
  }
}

/**
 * 화면 표시용 URL은 그대로 두고, PNG export 클론에서만 same-origin 프록시 경로로 바꿉니다.
 */
export function buildFlyerExportImageUrl(rawUrl: string): string {
  const u = rawUrl?.trim() ?? "";
  if (!u) return "";
  if (u.startsWith("data:")) return u;
  if (u.startsWith("blob:")) return u;

  if (u.startsWith("http://") || u.startsWith("https://")) {
    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(u);
        if (parsed.origin === window.location.origin) {
          return `${parsed.pathname}${parsed.search}`;
        }
      } catch {
        /* fall through to proxy */
      }
    }
    return flyerProxySrc(encodeURIComponent(u));
  }

  if (u.startsWith("//")) {
    return flyerProxySrc(encodeURIComponent(`https:${u}`));
  }

  if (u.startsWith("/")) {
    return u;
  }

  if (typeof window !== "undefined") {
    try {
      const abs = new URL(u, window.location.origin).href;
      if (abs.startsWith(window.location.origin)) {
        const pathAndQuery = abs.slice(window.location.origin.length);
        return pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
      }
      return flyerProxySrc(encodeURIComponent(abs));
    } catch {
      return u;
    }
  }

  return u;
}
