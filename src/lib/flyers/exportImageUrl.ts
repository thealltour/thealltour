const PROXY_PATH = "/api/flyers/image-proxy";

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
    return `${PROXY_PATH}?url=${encodeURIComponent(u)}`;
  }

  if (u.startsWith("//")) {
    return `${PROXY_PATH}?url=${encodeURIComponent(`https:${u}`)}`;
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
      return `${PROXY_PATH}?url=${encodeURIComponent(abs)}`;
    } catch {
      return u;
    }
  }

  return u;
}
