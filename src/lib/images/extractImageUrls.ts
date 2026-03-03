/**
 * HTML 또는 텍스트에서 이미지 URL을 최대한 추출하는 유틸.
 * - img src / data-src / data-lazy / data-original / srcset
 * - CSS url(), background-image
 * - 텍스트 내 https?:// ... (이미지 확장자)
 */

const IMG_SRC_ATTR = /<\s*img[^>]+?\bsrc\s*=\s*["']([^"']+)["']/gi;
const SRCSET_ATTR = /<\s*img[^>]+?\bsrcset\s*=\s*["']([^"']+)["']/gi;
const BACKGROUND_IMAGE_URL = /background-image\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
const CSS_URL = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/g;
const PLAIN_IMAGE_URL =
  /https?:\/\/[^\s<>"']+?\.(?:jpe?g|jpe|png|gif|webp|svg|bmp|ico)(?:\?[^\s<>"']*)?/gi;

const LAZY_ATTR_NAMES = [
  "data-src",
  "data-lazy-src",
  "data-lazy",
  "data-original",
  "data-url",
];

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function normalizeOne(raw: string): string {
  let u = raw.trim().replace(/^["'\s()]+|["'\s()]+$/g, "");
  if (u.startsWith("//")) u = "https:" + u;
  return u;
}

function parseSrcset(srcsetValue: string): string[] {
  const candidates: { url: string; w?: number; x?: number }[] = [];
  const parts = srcsetValue.split(",").map((p) => p.trim());
  for (const part of parts) {
    const match = part.match(/^\s*(.+?)\s+(\d+(?:\.\d+)?)(w|x)\s*$/);
    if (match) {
      const url = normalizeOne(match[1]);
      const num = parseFloat(match[2]);
      if (match[3] === "w") candidates.push({ url, w: num });
      else candidates.push({ url, x: num });
    } else {
      const url = normalizeOne(part);
      if (url) candidates.push({ url });
    }
  }
  if (candidates.length === 0) return [];
  const withSize = candidates.filter((c) => c.w != null || c.x != null);
  if (withSize.length > 0) {
    withSize.sort((a, b) => {
      const aw = a.w ?? (a.x ?? 0) * 100;
      const bw = b.w ?? (b.x ?? 0) * 100;
      return bw - aw;
    });
    return [withSize[0].url];
  }
  return [candidates[0].url];
}

function extractAllFromRegex(
  input: string,
  regex: RegExp,
  groupIndex: number,
): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(input)) !== null) {
    const raw = m[groupIndex];
    if (raw && isHttpUrl(normalizeOne(raw))) out.push(normalizeOne(raw));
  }
  return out;
}

function extractImgAttr(input: string, attrName: string): string[] {
  const regex = new RegExp(
    `<\\s*img[^>]+?\\b${attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*["']([^"']+)["']`,
    "gi",
  );
  return extractAllFromRegex(input, regex, 1);
}

function extractSrcsetUrls(input: string): string[] {
  const out: string[] = [];
  const re = new RegExp(SRCSET_ATTR.source, SRCSET_ATTR.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const urls = parseSrcset(m[1]);
    for (const u of urls) {
      if (isHttpUrl(u)) out.push(u);
    }
  }
  return out;
}

function extractBackgroundImageUrls(input: string): string[] {
  return extractAllFromRegex(input, BACKGROUND_IMAGE_URL, 1);
}

function extractCssUrlUrls(input: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CSS_URL.source, CSS_URL.flags);
  while ((m = re.exec(input)) !== null) {
    const u = normalizeOne(m[1]);
    if (isHttpUrl(u)) out.push(u);
  }
  return out;
}

function extractPlainImageUrls(input: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PLAIN_IMAGE_URL.source, PLAIN_IMAGE_URL.flags);
  while ((m = re.exec(input)) !== null) {
    const u = normalizeOne(m[0]);
    if (isHttpUrl(u)) out.push(u);
  }
  return out;
}

/**
 * HTML 또는 텍스트에서 이미지 URL을 최대한 추출합니다.
 * - http/https만 허용, 쿼리스트링 유지
 * - 중복 제거, 앞뒤 공백/따옴표/괄호 제거
 */
export function extractImageUrls(input: string): string[] {
  if (!input || typeof input !== "string") return [];

  const collected: string[] = [];

  collected.push(...extractAllFromRegex(input, IMG_SRC_ATTR, 1));

  for (const attr of LAZY_ATTR_NAMES) {
    collected.push(...extractImgAttr(input, attr));
  }

  collected.push(...extractSrcsetUrls(input));
  collected.push(...extractBackgroundImageUrls(input));
  collected.push(...extractCssUrlUrls(input));
  collected.push(...extractPlainImageUrls(input));

  const normalized = collected
    .map((u) => normalizeOne(u))
    .filter((u) => u.length > 0 && isHttpUrl(u));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of normalized) {
    if (!seen.has(u)) {
      seen.add(u);
      result.push(u);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 개발/테스트용 예시 (유닛 테스트 없이 실행해서 동작 확인용)
// ---------------------------------------------------------------------------

const EXAMPLES = [
  {
    name: "img src",
    input: '<img src="https://example.com/a.jpg" />',
    expect: ["https://example.com/a.jpg"],
  },
  {
    name: "img data-src",
    input: '<img data-src="https://cdn.com/lazy.png" alt="lazy" />',
    expect: ["https://cdn.com/lazy.png"],
  },
  {
    name: "srcset (가장 큰 해상도)",
    input:
      '<img srcset="https://a.com/sm.webp 480w, https://a.com/md.webp 800w, https://a.com/lg.webp 1200w" />',
    expect: ["https://a.com/lg.webp"],
  },
  {
    name: "background-image url()",
    input: 'div { background-image: url("https://example.com/bg.jpg"); }',
    expect: ["https://example.com/bg.jpg"],
  },
  {
    name: "url() 단순",
    input: "list-style-image: url(https://static.com/dot.png);",
    expect: ["https://static.com/dot.png"],
  },
  {
    name: "텍스트 내 이미지 URL",
    input: "상품 페이지: https://cdn.com/product/main.jpg?w=800 참고.",
    expect: ["https://cdn.com/product/main.jpg?w=800"],
  },
  {
    name: "복합 + 중복 제거",
    input: `
      <img src="https://same.com/1.jpg" />
      <p>링크 https://same.com/1.jpg</p>
      <img data-src="https://same.com/1.jpg" />
    `,
    expect: ["https://same.com/1.jpg"],
  },
];

export function runExtractImageUrlsExamples(): void {
  if (typeof process === "undefined" || process.env?.NODE_ENV === "production") return;
  console.log("[extractImageUrls] 예시 실행\n");
  for (const ex of EXAMPLES) {
    const got = extractImageUrls(ex.input);
    const ok = JSON.stringify(got) === JSON.stringify(ex.expect);
    console.log(ok ? "✓" : "✗", ex.name);
    if (!ok) {
      console.log("  기대:", ex.expect);
      console.log("  결과:", got);
    }
  }
}
