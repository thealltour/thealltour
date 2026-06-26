/**
 * 유인물 PNG용 이미지 프록시에서 허용하는 업스트림 호스트.
 * next.config `images.remotePatterns`와 정합을 맞추되, 와일드카드는 접미사 규칙으로 표현합니다.
 */

const EXACT_HOSTS = new Set(
  [
    "picsum.photos",
    "images.unsplash.com",
    "img.modetour.com",
    "qmswixmwquuazrhfyils.supabase.co",
    "images.kiwi.com",
    "prod-files-secure.s3.us-west-2.amazonaws.com",
    "s3.us-west-2.amazonaws.com",
    "www.notion.so",
    "notion.so",
    "images.notion.so",
    "file.notion.so",
    "img.notionusercontent.com",
    "quick-hen-cc9.notion.site",
    "image-tc.galaxy.tf",
    "static.hanatour.net",
  ].map((h) => h.toLowerCase()),
);

function hostSuffixes(): string[] {
  const extra = process.env.FLYER_IMAGE_PROXY_EXTRA_HOSTS?.trim();
  if (!extra) return [".googleusercontent.com", ".supabase.co", ".hanatour.com"];
  const parts = extra
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((h) => (h.startsWith(".") ? h : `.${h}`));
  return [".googleusercontent.com", ".supabase.co", ...parts];
}

/** localhost·사설·링크로컬·메타데이터 등 SSRF 후보 호스트명 차단 */
export function isFlyerImageProxyHostBlocked(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "[::]" || h === "::") return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(v4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const d = Number(m[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (h.includes(":")) {
    const low = h.replace(/^\[|\]$/g, "");
    if (low === "::1" || low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd")) return true;
  }

  return false;
}

export function isFlyerImageProxyHostAllowed(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h || isFlyerImageProxyHostBlocked(h)) return false;
  if (EXACT_HOSTS.has(h)) return true;
  for (const suf of hostSuffixes()) {
    if (h === suf.slice(1) || h.endsWith(suf)) return true;
  }
  return false;
}

export function assertFlyerImageProxyUrlAllowed(target: URL): void {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("invalid protocol");
  }
  if (!isFlyerImageProxyHostAllowed(target.hostname)) {
    throw new Error("host not allowed");
  }
}
