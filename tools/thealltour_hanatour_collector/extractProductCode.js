/**
 * 하나투어 상품 상세 페이지에서 saleProdCd / rprsProdCd 추출
 */
(function (global) {
  const RPRS_QUERY_RE = /rprsProdCd[s]?=([A-Z0-9]+)/i;

  function firstMatch(text, patterns) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return null;
  }

  const SALE_PATTERNS = [
    /"saleProdCd"\s*:\s*"([^"]+)"/,
    /'saleProdCd'\s*:\s*'([^']+)'/,
    /"pkgCd"\s*:\s*"([^"]+)"/,
    /'pkgCd'\s*:\s*'([^']+)'/,
    /"prodCode"\s*:\s*"([^"]+)"/,
    /'prodCode'\s*:\s*'([^']+)'/,
    /"pkgProdCd"\s*:\s*"([^"]+)"/,
  ];

  const RPRS_PATTERNS = [
    /"rprsProdCd"\s*:\s*"([^"]+)"/,
    /'rprsProdCd'\s*:\s*'([^']+)'/,
    /"rprsProdCds"\s*:\s*"([^"]+)"/,
    /'rprsProdCds'\s*:\s*'([^']+)'/,
    /"selectedRprsProd"\s*:\s*"([^"]+)"/,
  ];

  function firstCodeToken(raw) {
    if (!raw) return null;
    const first = String(raw)
      .split(/[,\s|]+/)
      .map((part) => part.trim())
      .find(Boolean);
    return first || null;
  }

  function extractCodesFromText(text) {
    if (!text) return { saleProdCd: null, rprsProdCd: null };
    return {
      saleProdCd: firstCodeToken(firstMatch(text, SALE_PATTERNS)),
      rprsProdCd: firstCodeToken(firstMatch(text, RPRS_PATTERNS)) || firstCodeToken(text.match(RPRS_QUERY_RE)?.[1]),
    };
  }

  function walkForProductCodes(node, depth, found) {
    if (depth > 6 || node == null) return;
    if (typeof node === "string") {
      const codes = extractCodesFromText(node);
      if (codes.saleProdCd || codes.rprsProdCd) found.push(codes);
      return;
    }
    if (typeof node !== "object") return;

    if (!Array.isArray(node)) {
      const direct = {
        saleProdCd:
          typeof node.saleProdCd === "string"
            ? node.saleProdCd
            : typeof node.prodCode === "string"
              ? node.prodCode
              : typeof node.pkgProdCd === "string"
                ? node.pkgProdCd
                : null,
        rprsProdCd:
          typeof node.rprsProdCd === "string"
            ? node.rprsProdCd
            : typeof node.rprsProdCds === "string"
              ? node.rprsProdCds
              : typeof node.selectedRprsProd === "string"
                ? node.selectedRprsProd
                : null,
      };
      const normalized = {
        saleProdCd: firstCodeToken(direct.saleProdCd),
        rprsProdCd: firstCodeToken(direct.rprsProdCd),
      };
      if (normalized.saleProdCd || normalized.rprsProdCd) found.push(normalized);
    }

    const children = Array.isArray(node) ? node.slice(0, 40) : Object.values(node).slice(0, 30);
    for (const child of children) {
      walkForProductCodes(child, depth + 1, found);
    }
  }

  function extractFromGlobals() {
    const found = [];
    const roots = [
      global.__INITIAL_STATE__,
      global.__NUXT__,
      global.__NEXT_DATA__,
      global.__PRELOADED_STATE__,
    ];
    for (const root of roots) {
      walkForProductCodes(root, 0, found);
    }
    return found;
  }

  function extractFromScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll("script"));
    let saleProdCd = null;
    let rprsProdCd = null;

    for (const script of scripts) {
      const text = script.textContent || "";
      if (
        !text.includes("saleProdCd") &&
        !text.includes("prodCode") &&
        !text.includes("rprsProdCd") &&
        !text.includes("rprsProdCds") &&
        !text.includes("pkgProdCd")
      ) {
        continue;
      }
      const codes = extractCodesFromText(text);
      saleProdCd = saleProdCd || codes.saleProdCd;
      rprsProdCd = rprsProdCd || codes.rprsProdCd;
      if (saleProdCd && rprsProdCd) break;
    }

    return { saleProdCd, rprsProdCd };
  }

  function extractFromBodyHtml(doc) {
    const html = doc.body?.innerHTML;
    if (!html) return { saleProdCd: null, rprsProdCd: null };
    return extractCodesFromText(html);
  }

  function extractFromUrl(doc) {
    const href = doc.defaultView?.location?.href ?? "";
    const fromCore = global.HanatourCollectorCore?.parseProductCodesFromHref?.(href);
    if (fromCore && (fromCore.saleProdCd || fromCore.rprsProdCd || fromCore.depDay)) {
      return fromCore;
    }
    let params;
    try {
      params = new URL(href).searchParams;
    } catch {
      params = new URLSearchParams(doc.defaultView?.location?.search ?? "");
    }
    const saleProdCd = firstCodeToken(
      params.get("saleProdCd") ||
        params.get("pkgCd") ||
        params.get("prodCode") ||
        params.get("pkgProdCd"),
    );
    const rprsProdCd = firstCodeToken(
      params.get("rprsProdCds") || params.get("rprsProdCd") || params.get("selectedRprsProd"),
    );
    const depDay = params.get("depDay")?.trim() || null;
    return {
      saleProdCd,
      rprsProdCd,
      depDay,
    };
  }

  function getMainContainer(doc) {
    return doc.querySelector(".prod_detail_top") ?? doc.querySelector("main") ?? doc.body ?? doc.documentElement;
  }

  function extractRprsFromAnchors(doc) {
    const parse = global.HanatourCollectorCore?.parseProductCodesFromHref;
    const base = doc.defaultView?.location?.href;

    const container = getMainContainer(doc);
    const candidates = Array.from(
      container?.querySelectorAll?.('a[href*="rprsProdCds="], a[href*="rprsProdCd="]') ?? [],
    );

    const isOtherDepartureAnchor = (a) => {
      const text = (a?.textContent ?? "").trim();
      if (!text) return false;
      if (text.includes("다른 출발일")) return true;
      // 페이지에서 쓰는 표현이 케이스마다 달라서, '최저가' 포함도 허용한다.
      if (text.includes("최저가로 떠날 수 있는 날") || text.includes("최저가")) return true;
      return false;
    };

    const preferred = candidates.find(
      (a) =>
        isOtherDepartureAnchor(a) &&
        ((a.getAttribute("href") ?? "").includes("rprsProdCds=") || (a.getAttribute("href") ?? "").includes("rprsProdCd=")),
    );
    const fallback = preferred ?? candidates[0];
    if (!fallback) return null;

    const href = fallback.getAttribute("href") || fallback.href || "";
    if (!href) return null;
    let absolute = href;
    try {
      absolute = base ? new URL(href, base).href : href;
    } catch {
      /* keep href */
    }
    const codes = parse?.(absolute);
    const rprs = codes?.rprsProdCd || firstCodeToken(href.match(RPRS_QUERY_RE)?.[1]);
    if (rprs) return rprs;
    return null;
  }

  function extractRprsFromRegex(doc) {
    // 앵커가 없을 때도 헤더/배너 오추출을 막기 위해, 메인 컨테이너 HTML 범위로 제한한다.
    const container = getMainContainer(doc);
    const text = container?.outerHTML ?? doc.body?.innerHTML ?? "";
    const query = text.match(RPRS_QUERY_RE);
    if (query?.[1]) return firstCodeToken(query[1]);
    return firstCodeToken(firstMatch(text, RPRS_PATTERNS));
  }

  function extractDepDayFromScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll("script"));
    for (const script of scripts) {
      const text = script.textContent || "";
      if (!text.includes("depDay")) continue;
      const match =
        text.match(/"depDay"\s*:\s*"(\d{8})"/) ||
        text.match(/'depDay'\s*:\s*'(\d{8})'/);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function extractHanatourProductCodes(doc) {
    const fromUrl = extractFromUrl(doc);
    let saleProdCd = fromUrl.saleProdCd;
    let rprsProdCd = fromUrl.rprsProdCd;
    let rprsSource = rprsProdCd ? "url" : null;

    if (!rprsProdCd) {
      rprsProdCd = extractRprsFromAnchors(doc);
      if (rprsProdCd) rprsSource = "href";
    }

    if (!rprsProdCd) {
      rprsProdCd = extractRprsFromRegex(doc);
      if (rprsProdCd) rprsSource = "regex";
    }

    const fromScripts = extractFromScripts(doc);
    const fromBody = extractFromBodyHtml(doc);
    saleProdCd = saleProdCd || fromScripts.saleProdCd || fromBody.saleProdCd;

    const fromCaptures = [];
    const captures = global.HanatourCalendarDiscover?.getCapturedPayloads?.() ?? [];
    for (const item of captures) {
      walkForProductCodes(item.json ?? item, 0, fromCaptures);
    }

    if (!rprsProdCd) {
      for (const item of fromCaptures) {
        if (item.rprsProdCd) {
          rprsProdCd = item.rprsProdCd;
          rprsSource = "discover";
          break;
        }
      }
    }

    if (!rprsProdCd) {
      for (const item of extractFromGlobals()) {
        saleProdCd = saleProdCd || item.saleProdCd;
        if (item.rprsProdCd) {
          rprsProdCd = item.rprsProdCd;
          rprsSource = "globals";
          break;
        }
        if (saleProdCd && rprsProdCd) break;
      }
    } else {
      for (const item of extractFromGlobals()) {
        saleProdCd = saleProdCd || item.saleProdCd;
        if (saleProdCd) break;
      }
    }

    const depDay = fromUrl.depDay || extractDepDayFromScripts(doc);
    if (rprsProdCd) {
      console.log("[Scrape] rprsProdCd source=", rprsSource, rprsProdCd);
    }

    return {
      saleProdCd: saleProdCd || null,
      rprsProdCd: rprsProdCd || null,
      depDay,
      rprsSource,
    };
  }

  global.HanatourProductCode = {
    extractHanatourProductCodes,
    extractFromUrl,
    extractRprsFromAnchors,
    extractRprsFromRegex,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
