/**

 * HTML 컨텍스트 보존형 수집 — UI prep + lazy 이미지 활성화 + 정제 HTML 캡처.

 * DOM 파싱 없음; AI가 HTML 시퀀스로 일정·이미지를 매핑합니다.

 */

(function (global) {

  const TRASH_SELECTORS = "script, style, iframe, noscript, svg, header, footer, nav";

  const JUNK_URL_RE = /logo|icon|banner|spinner|arrow|badge|avatar|favicon/i;



  function sleep(ms) {

    return new Promise((resolve) => setTimeout(resolve, ms));

  }



  function elementText(el) {

    return (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();

  }



  function isJunkImageUrl(url) {

    if (!url || url.startsWith("data:")) return true;

    return JUNK_URL_RE.test(url);

  }



  function pickBestSrcFromSrcset(srcset, baseUrl) {

    if (!srcset?.trim()) return null;

    const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);

    let best = null;

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

        best = part.split(/\s+/)[0];

      }

    }

    if (!best) return null;

    try {

      return new URL(best, baseUrl).href;

    } catch {

      return best.startsWith("http") ? best : null;

    }

  }



  function resolveImageUrl(img, baseUrl) {

    const attrs = [

      img.getAttribute("data-src"),

      img.getAttribute("data-original"),

      img.getAttribute("lazy-src"),

      img.getAttribute("data-lazy-src"),

      img.getAttribute("data-lazy"),

      img.currentSrc,

      img.src,

    ];

    for (const raw of attrs) {

      if (!raw?.trim() || raw.startsWith("data:")) continue;

      try {

        const abs = new URL(raw.trim(), baseUrl).href;

        if (!isJunkImageUrl(abs)) return abs;

      } catch {

        if (raw.startsWith("http") && !isJunkImageUrl(raw)) return raw.trim();

      }

    }

    const srcset =

      img.getAttribute("data-srcset") ?? img.getAttribute("srcset");

    const fromSet = pickBestSrcFromSrcset(srcset, baseUrl);

    if (fromSet && !isJunkImageUrl(fromSet)) return fromSet;

    return null;

  }



  function activateLazyLoadedImages(root) {

    root.querySelectorAll("img").forEach((img) => {

      const real = resolveImageUrl(img, global.location?.href ?? "");

      if (real) img.setAttribute("src", real);

    });

    root.querySelectorAll("source[srcset], source[data-srcset]").forEach((source) => {

      const srcset = source.getAttribute("data-srcset") ?? source.getAttribute("srcset");

      const best = pickBestSrcFromSrcset(srcset, global.location?.href ?? "");

      if (best) source.setAttribute("srcset", best);

    });

  }



  function clickTabByText(doc, patterns, exactPatterns) {

    const candidates = doc.querySelectorAll('[role="tab"], button, a[href="#"], a[role="button"], li');

    let fallback = null;

    for (const el of candidates) {

      const text = elementText(el);

      if (!text) continue;

      for (const exact of exactPatterns ?? []) {

        if (text === exact || new RegExp(`^${exact}$`, "i").test(text)) {

          el.click();

          return true;

        }

      }

      for (const pat of patterns) {

        if (pat.test(text)) {

          el.click();

          return true;

        }

      }

      if (!fallback && patterns.some((p) => p.test(text))) fallback = el;

    }

    if (fallback) {

      fallback.click();

      return true;

    }

    return false;

  }



  function clickMainItineraryTab(doc) {

    return clickTabByText(

      doc,

      [/^여행\s*일정$/i, /여행일정/, /^일정$/],

      ["여행일정", "여행 일정"],

    );

  }



  async function prepareSellingPointsView(doc) {

    clickTabByText(

      doc,

      [/상품\s*안내/, /핵심\s*포인트/, /상품안내/],

      ["상품안내", "상품 안내"],

    );

    await sleep(400);

  }



  function clickExpandAllItinerary(doc) {

    const candidates = doc.querySelectorAll("button, a, [role='button'], span");

    for (const el of candidates) {

      const text = elementText(el);

      if (/일정\s*전체\s*펼침|전체\s*펼침/i.test(text)) {

        el.click();

        return true;

      }

    }

    return false;

  }



  async function expandAccordionsIn(root, maxClicks) {

    const toggles = [];

    root.querySelectorAll('[aria-expanded="false"]').forEach((el) => toggles.push(el));

    let clicks = 0;

    for (const btn of toggles) {

      if (clicks >= (maxClicks ?? 60)) break;

      if (btn.getAttribute("aria-expanded") === "true") continue;

      btn.click();

      clicks++;

      await sleep(120);

    }

    return clicks;

  }



  async function prepareItineraryView(doc) {

    clickMainItineraryTab(doc);

    await sleep(500);

    clickExpandAllItinerary(doc);

    await sleep(400);

    const root = findHtmlCaptureRoot(doc) ?? doc.body;

    if (root) await expandAccordionsIn(root, 60);

    await sleep(300);

  }



  async function scrollToLoadLazyContent(doc) {

    const win = doc.defaultView ?? global;

    const body = doc.body ?? doc.documentElement;

    if (!win || !body) return;

    const step = Math.max(win.innerHeight || 600, 400);

    const maxY = Math.max(body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);

    const startY = win.scrollY ?? 0;

    for (let y = 0; y <= maxY; y += step) {

      win.scrollTo(0, y);

      await sleep(150);

    }

    win.scrollTo(0, startY);

    await sleep(200);

  }



  function findHtmlCaptureRoot(doc) {

    const panels = doc.querySelectorAll('[role="tabpanel"]');

    for (const panel of panels) {

      const hidden = panel.getAttribute("aria-hidden");

      if (hidden === "true") continue;

      const text = elementText(panel);

      if (/일차/.test(text) && text.length > 80) return panel;

    }

    for (const panel of panels) {

      if (panel.getAttribute("aria-hidden") !== "true" && elementText(panel).length > 80) {

        return panel;

      }

    }

    return (

      doc.querySelector("main") ??

      doc.querySelector('[role="main"]') ??

      doc.querySelector("#content") ??

      doc.body

    );

  }



  function minifyHtmlForAi(html) {

    if (!html) return "";

    return html

      .replace(/<!--[\s\S]*?-->/g, "")

      .replace(/\sclass="[^"]*"/gi, "")

      .replace(/\sstyle="[^"]*"/gi, "")

      .replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, "")

      .replace(/\saria-[a-z0-9_-]+="[^"]*"/gi, "")

      .replace(/\srole="[^"]*"/gi, "")

      .replace(/<img([^>]*?)>/gi, (_m, attrs) => {

        const src = attrs.match(/\ssrc="([^"]+)"/i)?.[1];

        const alt = attrs.match(/\salt="([^"]+)"/i)?.[1];

        if (!src) return "";

        return alt ? `<img src="${src}" alt="${alt}">` : `<img src="${src}">`;

      })

      .replace(/>\s+</g, "><")

      .replace(/\s{2,}/g, " ")

      .trim();

  }



  function minifyHtmlClone(clone) {

    clone.querySelectorAll(TRASH_SELECTORS).forEach((el) => el.remove());

    activateLazyLoadedImages(clone);

    clone.querySelectorAll("*").forEach((el) => {

      const tag = el.tagName.toLowerCase();

      const kept = [];

      if (tag === "img") {

        const src = el.getAttribute("src");

        if (src) kept.push(["src", src]);

        const alt = el.getAttribute("alt");

        if (alt) kept.push(["alt", alt]);

      }

      while (el.attributes.length > 0) {

        el.removeAttribute(el.attributes[0].name);

      }

      for (const [name, value] of kept) {

        el.setAttribute(name, value);

      }

    });

    return minifyHtmlForAi(clone.innerHTML);

  }



  function buildPageTextForMeta(doc, maxChars) {

    const limit = maxChars ?? 18000;

    const root = doc.querySelector("main") ?? doc.body;

    const text = (root?.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();

    return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text;

  }



  function appendMetaText(base, extra, maxChars) {

    const limit = maxChars ?? 18000;

    if (!extra?.trim()) return base;

    const combined = `${base}\n\n[상품안내·핵심포인트 영역]\n${extra.trim()}`;

    return combined.length > limit ? `${combined.slice(0, limit)}\n…(truncated)` : combined;

  }



  function stripSiteSuffixFromDocumentTitle(raw) {

    if (!raw?.trim()) return "";

    return raw

      .trim()

      .replace(/\s*[-|·]\s*(하나투어|HANATOUR|모두투어|MODETOUR).*$/i, "")

      .trim();

  }



  function pickLongestTitleCandidate(candidates) {

    const cleaned = candidates.map((c) => c?.trim()).filter(Boolean);

    if (cleaned.length === 0) return undefined;

    return cleaned.sort((a, b) => b.length - a.length)[0];

  }



  function extractSourceProductTitle(doc) {

    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");

    const h1 = doc.querySelector("main h1")?.innerText ?? doc.querySelector("h1")?.innerText;

    const docTitle = stripSiteSuffixFromDocumentTitle(doc.title);

    return pickLongestTitleCandidate([ogTitle, h1, docTitle]);

  }



  function normalizeHashtagToken(raw) {

    return raw.trim().replace(/^#+/, "").trim();

  }



  function collectHashtagTokensFromText(text, push) {

    if (!text?.trim()) return;

    const matches = text.match(/#[^\s#]+/g);

    if (matches) {

      for (const match of matches) {

        const token = normalizeHashtagToken(match);

        if (token) push(token);

      }

    }

  }



  function findHashtagSectionRoot(doc) {

    const candidates = doc.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, label, button, strong");

    for (const el of candidates) {

      const text = elementText(el);

      if (!text) continue;

      if (/AI\s*해시태그/i.test(text) || (text.includes("해시태그") && /AI/i.test(text))) {

        return el.closest("section, article, div") ?? el.parentElement ?? el;

      }

      if (text === "해시태그" || text.endsWith("해시태그")) {

        const container = el.closest("section, article, div") ?? el.parentElement;

        if (container && /AI/i.test(elementText(container).slice(0, 80))) {

          return container;

        }

      }

    }

    return null;

  }



  function extractAiSeoHashtags(doc) {

    const seen = new Set();

    const out = [];

    const push = (token) => {

      const normalized = normalizeHashtagToken(token);

      if (!normalized || seen.has(normalized)) return;

      seen.add(normalized);

      out.push(normalized);

    };



    const sectionRoot = findHashtagSectionRoot(doc);

    if (sectionRoot) {

      collectHashtagTokensFromText(sectionRoot.innerText ?? "", push);

      sectionRoot.querySelectorAll("span, a, button, li, p, div").forEach((el) => {

        const text = elementText(el);

        if (/^#[\w가-힣]+/.test(text)) collectHashtagTokensFromText(text, push);

      });

    }



    if (out.length === 0) {

      const main = doc.querySelector("main") ?? doc.body;

      if (main) {

        main.querySelectorAll("span, a, button, li, p").forEach((el) => {

          const text = elementText(el);

          if (/^#[\w가-힣]{2,}/.test(text)) collectHashtagTokensFromText(text, push);

        });

      }

    }



    return out;

  }



  function sanitizeHtmlClone(clone) {

    return minifyHtmlClone(clone);

  }



  function buildCleanHtmlStructure(doc) {

    const root = findHtmlCaptureRoot(doc) ?? doc.body;

    if (!root) return "";

    const clone = root.cloneNode(true);

    return sanitizeHtmlClone(clone);

  }



  function isInsideItineraryPanel(el) {

    let node = el;

    while (node) {

      if (node.getAttribute?.("role") === "tabpanel") {

        const text = elementText(node);

        if (/일차/.test(text)) return true;

      }

      node = node.parentElement;

    }

    return false;

  }



  function findHeroGalleryRoot(doc) {

    const main = doc.querySelector("main") ?? doc.body;

    if (!main) return null;



    const swipers = [...main.querySelectorAll(".swiper, [class*='swiper']")].filter(

      (el) => !isInsideItineraryPanel(el),

    );

    if (swipers.length > 0) return swipers[0];



    const galleries = [...main.querySelectorAll("[class*='gallery']")].filter(

      (el) => !isInsideItineraryPanel(el),

    );

    if (galleries.length > 0) return galleries[0];



    return main;

  }



  function collectOgImageUrl(doc) {

    const baseUrl = doc.defaultView?.location?.href ?? global.location?.href ?? "";

    const selectors = [

      'meta[property="og:image"]',

      'meta[name="og:image"]',

      'meta[property="twitter:image"]',

    ];

    for (const sel of selectors) {

      const el = doc.querySelector(sel);

      const content = el?.getAttribute("content")?.trim();

      if (!content || isJunkImageUrl(content)) continue;

      try {

        return new URL(content, baseUrl).href;

      } catch {

        if (content.startsWith("http")) return content;

      }

    }

    return null;

  }



  function collectSlideImages(slide, baseUrl, push) {

    slide.querySelectorAll("img").forEach((img) => {

      const url = resolveImageUrl(img, baseUrl);

      if (url) push(url);

    });

  }



  function collectPageGalleryUrls(doc, maxCount = 10) {

    const baseUrl = doc.defaultView?.location?.href ?? global.location?.href ?? "";

    const heroRoot = findHeroGalleryRoot(doc);

    if (!heroRoot) return { productGalleryUrls: [], heroImageUrl: undefined };



    const seen = new Set();

    const out = [];

    const push = (url) => {

      if (!url || seen.has(url) || isJunkImageUrl(url)) return;

      seen.add(url);

      out.push(url);

    };



    const ogImage = collectOgImageUrl(doc);

    if (ogImage) push(ogImage);



    const slideSelectors = [".swiper-slide-active", ".swiper-slide", "[class*='swiper-slide']"];

    const collectedSlides = new Set();

    for (const sel of slideSelectors) {

      try {

        heroRoot.querySelectorAll(sel).forEach((slide) => {

          if (collectedSlides.has(slide)) return;

          collectedSlides.add(slide);

          collectSlideImages(slide, baseUrl, push);

        });

      } catch {

        /* ignore */

      }

    }



    if (out.length === 0) {

      let count = 0;

      for (const img of heroRoot.querySelectorAll("img")) {

        if (count >= maxCount * 2) break;

        const url = resolveImageUrl(img, baseUrl);

        if (url) push(url);

        count++;

      }

    }



    const productGalleryUrls = out.slice(0, maxCount);

    return {

      productGalleryUrls,

      heroImageUrl: productGalleryUrls[0],

    };

  }



  async function capturePageContext(doc, onProgress) {

    onProgress?.(8, "대표 이미지 수집 중…");

    activateLazyLoadedImages(doc);

    const { productGalleryUrls, heroImageUrl } = collectPageGalleryUrls(doc);

    const sourceProductTitle = extractSourceProductTitle(doc);

    const seoHashtags = extractAiSeoHashtags(doc);



    onProgress?.(12, "상품 정보 수집 중…");

    let rawHtmlText = buildPageTextForMeta(doc);



    onProgress?.(16, "상품안내 탭 펼치는 중…");

    await prepareSellingPointsView(doc);

    const sellingText = buildPageTextForMeta(doc, 8000);

    rawHtmlText = appendMetaText(rawHtmlText, sellingText);



    onProgress?.(20, "일정 탭 펼치는 중…");

    await prepareItineraryView(doc);

    onProgress?.(28, "이미지 로딩 중…");

    await scrollToLoadLazyContent(doc);

    activateLazyLoadedImages(doc);

    onProgress?.(34, "HTML 구조 수집 중…");

    const cleanHtmlStructure = buildCleanHtmlStructure(doc);

    onProgress?.(36, "일정 블록 추출 중…");

    const itineraryBlocks =
      global.ItineraryDomExtract?.extractItineraryBlocks?.(doc) ?? [];

    onProgress?.(38, "수집 완료");

    return {
      cleanHtmlStructure,
      rawHtmlText,
      productGalleryUrls,
      heroImageUrl,
      sourceProductTitle,
      seoHashtags,
      itineraryBlocks,
    };

  }



  global.HtmlContextExtract = {

    sleep,

    activateLazyLoadedImages,

    minifyHtmlForAi,

    sanitizeHtmlClone,

    buildCleanHtmlStructure,

    buildPageTextForMeta,

    collectPageGalleryUrls,

    extractSourceProductTitle,

    extractAiSeoHashtags,

    prepareItineraryView,

    prepareSellingPointsView,

    scrollToLoadLazyContent,

    capturePageContext,

  };

})(typeof globalThis !== "undefined" ? globalThis : window);

