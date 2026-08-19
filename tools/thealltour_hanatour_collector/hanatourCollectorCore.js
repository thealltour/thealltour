/**
 * 하나투어 수집기 — URL 파싱·월 범위·캘린더 JSON 정규화 (테스트 가능한 순수 로직)
 */
(function (global) {
  const YEAR_MONTH_RE = /^\d{6}$/;
  const DEP_DAY_RE = /^(\d{4})(\d{2})(\d{2})$/;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  function firstCodeToken(raw) {
    if (!raw) return null;
    const first = String(raw)
      .split(/[,\s|]+/)
      .map((part) => part.trim())
      .find(Boolean);
    return first || null;
  }

  function parseProductCodesFromSearch(search) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const saleProdCd = firstCodeToken(
      firstNonEmpty(
        params.get("saleProdCd"),
        params.get("pkgCd"),
        params.get("prodCode"),
        params.get("pkgProdCd"),
      ),
    );
    const rprsProdCd = firstCodeToken(
      firstNonEmpty(params.get("rprsProdCd"), params.get("rprsProdCds"), params.get("selectedRprsProd")),
    );
    const depDay = firstNonEmpty(params.get("depDay"));
    return { saleProdCd, rprsProdCd, depDay };
  }

  function parseProductCodesFromHref(href) {
    try {
      const url = new URL(href);
      return parseProductCodesFromSearch(url.search);
    } catch {
      return { saleProdCd: null, rprsProdCd: null, depDay: null };
    }
  }

  function isHanatourHost(hostname) {
    return /(^|\.)hanatour\.com$/i.test(hostname || "");
  }

  function isHanatourProductPageUrl(href) {
    try {
      const url = new URL(href);
      if (!isHanatourHost(url.hostname)) return false;
      if (/\/trp\/pkg\//i.test(url.pathname)) return true;
      const codes = parseProductCodesFromSearch(url.search);
      return Boolean(codes.saleProdCd);
    } catch {
      return false;
    }
  }

  function yearMonthFromDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function addMonthsToDate(date, months) {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function buildYearMonthRange(startDate, monthSpan) {
    const start = startDate instanceof Date ? startDate : new Date();
    const span = Number.isFinite(monthSpan) ? monthSpan : 12;
    return {
      strtYearMonth: yearMonthFromDate(start),
      endYearMonth: yearMonthFromDate(addMonthsToDate(start, span)),
    };
  }

  function yearMonthFromDepDay(depDay) {
    const match = String(depDay ?? "").match(DEP_DAY_RE);
    if (!match) return null;
    return `${match[1]}${match[2]}`;
  }

  function normalizeCalendarDay(raw) {
    if (!isObject(raw) && typeof raw !== "string") return null;
    if (typeof raw === "string") {
      const depDay = raw.trim();
      return DEP_DAY_RE.test(depDay) ? { depDay } : null;
    }
    const depDay = firstNonEmpty(
      raw.depDay,
      raw.dep_day,
      raw.dt,
      typeof raw.day === "string" ? raw.day : null,
    );
    if (!depDay || !DEP_DAY_RE.test(depDay.replace(/-/g, ""))) {
      const compact = (depDay ?? "").replace(/-/g, "");
      if (!DEP_DAY_RE.test(compact)) return null;
      return {
        depDay: compact,
        depDayNm: typeof raw.depDayNm === "string" ? raw.depDayNm : undefined,
        adtAmt:
          raw.adtAmt != null
            ? String(raw.adtAmt)
            : raw.minAmt != null
              ? String(raw.minAmt)
              : undefined,
      };
    }
    const compact = depDay.replace(/-/g, "");
    const adt =
      raw.adtAmt != null
        ? String(raw.adtAmt)
        : raw.minAmt != null
          ? String(raw.minAmt)
          : raw.price != null
            ? String(raw.price)
            : undefined;
    return {
      depDay: compact,
      depDayNm: typeof raw.depDayNm === "string" ? raw.depDayNm : undefined,
      adtAmt: adt,
      minAmtYn: typeof raw.minAmtYn === "string" ? raw.minAmtYn : undefined,
      selected: typeof raw.selected === "string" ? raw.selected : undefined,
    };
  }

  function mergeMonthMap(target, source) {
    if (!isObject(source)) return target;
    for (const [key, rows] of Object.entries(source)) {
      const ym = YEAR_MONTH_RE.test(key) ? key : yearMonthFromDepDay(key);
      if (!Array.isArray(rows) || !ym) continue;
      const days = rows.map(normalizeCalendarDay).filter(Boolean);
      if (days.length === 0) continue;
      if (!target[ym]) target[ym] = [];
      const seen = new Set(target[ym].map((d) => d.depDay));
      for (const day of days) {
        if (seen.has(day.depDay)) continue;
        seen.add(day.depDay);
        target[ym].push(day);
      }
    }
    return target;
  }

  function collectDaysFromUnknown(value, target) {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) collectDaysFromUnknown(item, target);
      return;
    }
    if (!isObject(value)) return;

    if (Array.isArray(value.calList)) collectDaysFromUnknown(value.calList, target);
    if (Array.isArray(value.list)) collectDaysFromUnknown(value.list, target);
    if (Array.isArray(value.days)) collectDaysFromUnknown(value.days, target);

    const day = normalizeCalendarDay(value);
    if (day) {
      const ym = yearMonthFromDepDay(day.depDay);
      if (ym) {
        if (!target[ym]) target[ym] = [];
        if (!target[ym].some((d) => d.depDay === day.depDay)) target[ym].push(day);
      }
    }

    for (const [key, rows] of Object.entries(value)) {
      if (YEAR_MONTH_RE.test(key) && Array.isArray(rows)) {
        mergeMonthMap(target, { [key]: rows });
      }
    }
  }

  function normalizeYearMonthCalJson(json) {
    if (!isObject(json)) return null;
    const target = {};

    if (isObject(json.searchCalendar)) mergeMonthMap(target, json.searchCalendar);
    if (isObject(json.data?.searchCalendar)) mergeMonthMap(target, json.data.searchCalendar);
    if (isObject(json.calList) && !Array.isArray(json.calList)) mergeMonthMap(target, json.calList);
    if (isObject(json.data) && !Array.isArray(json.data)) {
      mergeMonthMap(target, json.data);
    }
    if (Array.isArray(json.calList)) collectDaysFromUnknown(json.calList, target);
    if (Array.isArray(json.data)) collectDaysFromUnknown(json.data, target);
    if (Array.isArray(json.data?.calList)) collectDaysFromUnknown(json.data.calList, target);
    if (Array.isArray(json.data?.data)) collectDaysFromUnknown(json.data.data, target);

    return Object.keys(target).length > 0 ? target : null;
  }

  function isYearMonthKeyMap(value) {
    if (!isObject(value) || Array.isArray(value)) return false;
    return Object.keys(value).some((key) => YEAR_MONTH_RE.test(key));
  }

  /** getListYearMonthCal 응답에서 searchCalendar 추출 — data 또는 calList 우선 */
  function resolveSearchCalendarFromApiResponse(json) {
    if (!isObject(json)) return normalizeYearMonthCalJson(json);
    const candidate = json.data ?? json.calList ?? null;
    if (candidate != null) {
      if (isYearMonthKeyMap(candidate)) {
        const normalized = normalizeYearMonthCalJson({ data: candidate });
        if (normalized) return normalized;
      }
      if (Array.isArray(candidate)) {
        const normalized = normalizeYearMonthCalJson({ calList: candidate });
        if (normalized) return normalized;
      }
      if (isObject(candidate) && isObject(candidate.searchCalendar)) {
        const normalized = normalizeYearMonthCalJson({ data: candidate });
        if (normalized) return normalized;
      }
    }
    return normalizeYearMonthCalJson(json);
  }

  function buildHanatourCalendarPayload(prodCode, calApiResponse) {
    const searchCalendar = resolveSearchCalendarFromApiResponse(calApiResponse);
    return {
      rprsProdCd: prodCode ?? null,
      searchCalendar: searchCalendar ?? undefined,
    };
  }

  function countSearchCalendarDays(searchCalendar) {
    if (!isObject(searchCalendar)) return 0;
    let count = 0;
    for (const rows of Object.values(searchCalendar)) {
      if (Array.isArray(rows)) count += rows.length;
    }
    return count;
  }

  function buildCleanHtmlStructure(parts) {
    const lines = [];
    const ogTitle = parts?.ogTitle?.trim();
    const description = parts?.description?.trim();
    const ogImage = parts?.ogImage?.trim();
    const innerText = parts?.innerText?.trim();
    if (ogTitle) lines.push(`[og:title]\n${ogTitle}`);
    if (description) lines.push(`[meta description]\n${description}`);
    if (ogImage) lines.push(`[og:image]\n${ogImage}`);
    if (innerText) lines.push(innerText);
    return lines.join("\n\n");
  }

  function isHanatourImageUrl(src) {
    const href = String(src ?? "").toLowerCase();
    if (!href || href.startsWith("data:")) return false;
    return href.includes("image.hanatour.com") || href.includes("static.hanatour.com");
  }

  function uniqueGalleryUrls(urls, max = 30) {
    const seen = new Set();
    const out = [];
    for (const raw of urls ?? []) {
      const src = String(raw ?? "").trim();
      if (!src || seen.has(src) || !isHanatourImageUrl(src)) continue;
      seen.add(src);
      out.push(src);
      if (out.length >= max) break;
    }
    return out;
  }

  global.HanatourCollectorCore = {
    parseProductCodesFromSearch,
    parseProductCodesFromHref,
    isHanatourProductPageUrl,
    isHanatourHost,
    yearMonthFromDate,
    buildYearMonthRange,
    normalizeYearMonthCalJson,
    resolveSearchCalendarFromApiResponse,
    buildHanatourCalendarPayload,
    countSearchCalendarDays,
    buildCleanHtmlStructure,
    isHanatourImageUrl,
    uniqueGalleryUrls,
    YEAR_MONTH_CAL_URL: "https://www.hanatour.com/api/package/getListYearMonthCal",
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
