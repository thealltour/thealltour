/**
 * 하나투어 상품 상세 페이지에서 saleProdCd / rprsProdCd 추출
 */
(function (global) {
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
  ];

  function extractCodesFromText(text) {
    if (!text) return { saleProdCd: null, rprsProdCd: null };
    return {
      saleProdCd: firstMatch(text, SALE_PATTERNS),
      rprsProdCd: firstMatch(text, RPRS_PATTERNS),
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
        rprsProdCd: typeof node.rprsProdCd === "string" ? node.rprsProdCd : null,
      };
      if (direct.saleProdCd || direct.rprsProdCd) found.push(direct);
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
    const params = new URLSearchParams(doc.defaultView?.location?.search ?? "");
    const saleProdCd =
      params.get("saleProdCd") ||
      params.get("pkgCd") ||
      params.get("prodCode") ||
      params.get("pkgProdCd") ||
      null;
    const rprsProdCd = params.get("rprsProdCd") || null;
    const depDay = params.get("depDay") || null;
    return {
      saleProdCd: saleProdCd?.trim() || null,
      rprsProdCd: rprsProdCd?.trim() || null,
      depDay: depDay?.trim() || null,
    };
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
    const fromScripts = extractFromScripts(doc);
    const fromUrl = extractFromUrl(doc);
    const fromBody = extractFromBodyHtml(doc);
    const fromGlobals = extractFromGlobals();

    let saleProdCd = fromUrl.saleProdCd || fromScripts.saleProdCd || fromBody.saleProdCd;
    let rprsProdCd = fromUrl.rprsProdCd || fromScripts.rprsProdCd || fromBody.rprsProdCd;

    for (const item of fromGlobals) {
      saleProdCd = saleProdCd || item.saleProdCd;
      rprsProdCd = rprsProdCd || item.rprsProdCd;
      if (saleProdCd && rprsProdCd) break;
    }

    const depDay = fromUrl.depDay || extractDepDayFromScripts(doc);
    return {
      saleProdCd: saleProdCd || null,
      rprsProdCd: rprsProdCd || null,
      depDay,
    };
  }

  global.HanatourProductCode = {
    extractHanatourProductCodes,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
