/** HTML 컨텍스트 수집 유틸 — 익스텐션 htmlContextExtract.js와 동일 로직 (테스트용) */

const TRASH_SELECTORS = "script, style, iframe, noscript, svg, header, footer, nav";
const JUNK_URL_RE = /logo|icon|banner|spinner|arrow|badge|avatar|favicon/i;

export function isJunkImageUrl(url: string | null | undefined): boolean {
  if (!url || url.startsWith("data:")) return true;
  return JUNK_URL_RE.test(url);
}

export function pickBestSrcFromSrcset(srcset: string | null | undefined, baseUrl: string): string | null {
  if (!srcset?.trim()) return null;
  const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
  let best: string | null = null;
  let bestW = -1;
  for (const part of parts) {
    const m = part.match(/^(\S+)\s+(\d+)w$/);
    if (m) {
      const w = parseInt(m[2], 10);
      if (w > bestW) {
        bestW = w;
        best = m[1];
      }
    } else if (!best) {
      best = part.split(/\s+/)[0] ?? null;
    }
  }
  if (!best) return null;
  try {
    return new URL(best, baseUrl).href;
  } catch {
    return best.startsWith("http") ? best : null;
  }
}

export function resolveImageUrlFromAttrs(
  attrs: {
    dataSrc?: string | null;
    dataOriginal?: string | null;
    lazySrc?: string | null;
    currentSrc?: string | null;
    src?: string | null;
    srcset?: string | null;
  },
  baseUrl: string,
): string | null {
  const candidates = [
    attrs.dataSrc,
    attrs.dataOriginal,
    attrs.lazySrc,
    attrs.currentSrc,
    attrs.src,
  ];
  for (const raw of candidates) {
    if (!raw?.trim() || raw.startsWith("data:")) continue;
    try {
      const abs = new URL(raw.trim(), baseUrl).href;
      if (!isJunkImageUrl(abs)) return abs;
    } catch {
      if (raw.startsWith("http") && !isJunkImageUrl(raw)) return raw.trim();
    }
  }
  const fromSet = pickBestSrcFromSrcset(attrs.srcset, baseUrl);
  if (fromSet && !isJunkImageUrl(fromSet)) return fromSet;
  return null;
}

export function activateLazyLoadedImagesOnElement(root: Element, baseUrl: string): void {
  root.querySelectorAll("img").forEach((img) => {
    const real = resolveImageUrlFromAttrs(
      {
        dataSrc: img.getAttribute("data-src"),
        dataOriginal: img.getAttribute("data-original"),
        lazySrc: img.getAttribute("lazy-src") ?? img.getAttribute("data-lazy-src"),
        currentSrc: img.getAttribute("src"),
        src: img.getAttribute("src"),
        srcset: img.getAttribute("data-srcset") ?? img.getAttribute("srcset"),
      },
      baseUrl,
    );
    if (real) img.setAttribute("src", real);
  });
}

export function sanitizeHtmlClone(clone: Element, baseUrl = "https://example.com"): string {
  clone.querySelectorAll(TRASH_SELECTORS).forEach((el) => el.remove());
  activateLazyLoadedImagesOnElement(clone, baseUrl);
  return clone.innerHTML;
}

export function truncatePageContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n…(truncated)`;
}

/** AI 토큰 절약: class/style/data-* 제거, img는 src·alt만 유지 */
export function minifyHtmlForAi(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, "")
    .replace(/\saria-[a-z0-9_-]+="[^"]*"/gi, "")
    .replace(/\srole="[^"]*"/gi, "")
    .replace(/<img([^>]*?)>/gi, (_m, attrs: string) => {
      const src = attrs.match(/\ssrc="([^"]+)"/i)?.[1];
      const alt = attrs.match(/\salt="([^"]+)"/i)?.[1];
      if (!src) return "";
      return alt ? `<img src="${src}" alt="${alt}">` : `<img src="${src}">`;
    })
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function minifyHtmlClone(clone: Element, baseUrl = "https://example.com"): string {
  clone.querySelectorAll(TRASH_SELECTORS).forEach((el) => el.remove());
  activateLazyLoadedImagesOnElement(clone, baseUrl);
  clone.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const kept: [string, string][] = [];
    if (tag === "img") {
      const src = el.getAttribute("src");
      if (src) kept.push(["src", src]);
      const alt = el.getAttribute("alt");
      if (alt) kept.push(["alt", alt]);
    }
    while (el.attributes.length > 0) {
      el.removeAttribute(el.attributes[0]!.name);
    }
    for (const [name, value] of kept) {
      el.setAttribute(name, value);
    }
  });
  return minifyHtmlForAi(clone.innerHTML);
}
