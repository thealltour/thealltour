/** 하나투어 CDN http URL을 https로 승격 (next/image remotePatterns 호환) */
export function upgradeHanatourImageUrl(url: string): string {
  const t = url?.trim();
  if (!t) return url;
  try {
    const u = new URL(t);
    if (u.protocol === "http:" && u.hostname.toLowerCase().endsWith("hanatour.com")) {
      u.protocol = "https:";
      return u.href;
    }
    return t;
  } catch {
    return url;
  }
}

export function isHanatourUiStockImageUrl(url: string): boolean {
  try {
    const u = new URL(url.trim(), "https://x");
    if (!u.hostname.toLowerCase().endsWith("hanatour.com")) return false;
    const path = u.pathname.toLowerCase();
    if (/\/schedule\/caution_/i.test(path)) return true;
    if (/\/schedule\//i.test(path) && /caution|icon|btn|arrow|freetime/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}
