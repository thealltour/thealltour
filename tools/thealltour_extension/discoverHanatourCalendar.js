/**
 * 하나투어 상세 페이지에서 searchCalendar 역추적
 * - fetch/XHR 응답 캡처
 * - script / 전역 상태 파싱
 * - multi-endpoint trial
 */
(function (global) {
  const capturedPayloads = [];

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasValidSearchCalendar(json) {
    const cal = extractSearchCalendar(json);
    return countCalendarDays(cal) > 0;
  }

  function isCalendarRelatedUrl(source) {
    const u = String(source ?? "").toLowerCase();
    return (
      /saleprodsearch|saleprodcalendar|front\/common\/calendar|searchcalendar|pkgcalendar|\/calendar\?/.test(
        u,
      )
    );
  }

  function extractCalendarRowsFromPayload(json) {
    const rows = [];
    function walk(node, depth) {
      if (depth > 12 || node == null) return;
      if (Array.isArray(node)) {
        for (const item of node.slice(0, 80)) walk(item, depth + 1);
        return;
      }
      if (!isObject(node)) return;

      const depRaw =
        node.depDay ?? node.depDt ?? node.departureDay ?? node.depDate ?? node.startDt;
      const amtRaw =
        node.adtAmt ?? node.price ?? node.saleAmt ?? node.minAmt ?? node.minPrice ?? node.amt;
      if (depRaw && amtRaw != null && String(amtRaw) !== "-") {
        const depDay = String(depRaw).replace(/\D/g, "");
        if (depDay.length === 8) rows.push({ ...node, depDay });
      }

      const values = Array.isArray(node) ? node : Object.values(node);
      for (const value of values.slice(0, 50)) walk(value, depth + 1);
    }
    walk(json, 0);
    return rows;
  }

  function rowsToSearchCalendar(rows) {
    const searchCalendar = {};
    const seen = new Set();
    for (const row of rows) {
      const depDay = String(row.depDay ?? "").replace(/\D/g, "");
      if (depDay.length !== 8 || seen.has(depDay)) continue;
      const ym = depDay.slice(0, 6);
      const amt = row.adtAmt ?? row.price ?? row.saleAmt ?? row.minAmt ?? row.minPrice ?? row.amt;
      if (amt == null || String(amt) === "-") continue;
      seen.add(depDay);
      if (!searchCalendar[ym]) searchCalendar[ym] = [];
      searchCalendar[ym].push({
        depDay,
        depDayNm:
          row.depDayNm ??
          `${depDay.slice(4, 6)}.${depDay.slice(6, 8)}`,
        adtAmt: String(amt),
      });
    }
    return countCalendarDays(searchCalendar) > 0 ? searchCalendar : null;
  }

  function extractSearchCalendar(json) {
    if (!isObject(json)) return null;
    const fromData = json.data?.searchCalendar;
    if (isObject(fromData) && Object.keys(fromData).length > 0) return fromData;
    const root = json.searchCalendar;
    if (isObject(root) && Object.keys(root).length > 0) return root;

    const fromRows = rowsToSearchCalendar(extractCalendarRowsFromPayload(json));
    if (fromRows) return fromRows;

    return null;
  }

  function countCalendarDays(searchCalendar) {
    if (!isObject(searchCalendar)) return 0;
    let count = 0;
    for (const rows of Object.values(searchCalendar)) {
      if (Array.isArray(rows)) count += rows.length;
    }
    return count;
  }

  function countCalendarMonths(searchCalendar) {
    if (!isObject(searchCalendar)) return 0;
    return Object.values(searchCalendar).filter((rows) => Array.isArray(rows) && rows.length > 0).length;
  }

  const MIN_DAYS_FOR_SUFFICIENT = 5;
  const MIN_MONTHS_FOR_SUFFICIENT = 2;

  function isCalendarSufficient(result) {
    if (!result) return false;
    const days = countCalendarDays(result.searchCalendar);
    const months = countCalendarMonths(result.searchCalendar);
    if (days >= MIN_DAYS_FOR_SUFFICIENT || months >= MIN_MONTHS_FOR_SUFFICIENT) {
      return true;
    }
    return Array.isArray(result.calendarData) && result.calendarData.length >= MIN_DAYS_FOR_SUFFICIENT;
  }

  function mergeSearchCalendar(target, source) {
    if (!isObject(source)) return target;
    for (const [key, rows] of Object.entries(source)) {
      if (Array.isArray(rows) && rows.length > 0) {
        target[key] = rows;
      }
    }
    return target;
  }

  function mergeCalendarData(target, rows) {
    if (!Array.isArray(rows)) return target;
    const seen = new Set(target.map((r) => r?.depDay).filter(Boolean));
    for (const row of rows) {
      if (!row?.depDay || seen.has(row.depDay)) continue;
      seen.add(row.depDay);
      target.push(row);
    }
    return target;
  }

  function tryParseJson(text) {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  function walkForCalendar(node, depth, found) {
    if (depth > 8 || node == null) return;
    if (typeof node === "string") {
      const parsed = tryParseJson(node);
      if (parsed && hasValidSearchCalendar(parsed)) found.push(parsed);
      return;
    }
    if (!isObject(node) && !Array.isArray(node)) return;

    if (isObject(node) && hasValidSearchCalendar(node)) {
      found.push(node);
    }

    if (Array.isArray(node)) {
      for (const item of node.slice(0, 50)) walkForCalendar(item, depth + 1, found);
      return;
    }

    for (const value of Object.values(node).slice(0, 40)) {
      walkForCalendar(value, depth + 1, found);
    }
  }

  function extractFromScripts(doc) {
    const found = [];
    for (const script of doc.querySelectorAll("script")) {
      const text = script.textContent || "";
      if (!text.includes("searchCalendar")) continue;
      walkForCalendar(tryParseJson(text), 0, found);
      const idx = text.indexOf('"searchCalendar"');
      if (idx < 0) continue;
      const slice = text.slice(Math.max(0, idx - 200), idx + 12000);
      const parsed = tryParseJson(`{${slice}`);
      if (parsed && hasValidSearchCalendar(parsed)) found.push(parsed);
    }
    return found;
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
      walkForCalendar(root, 0, found);
    }
    return found;
  }

  function rememberCapture(json, source) {
    if (hasValidSearchCalendar(json)) {
      capturedPayloads.push({ json, source, at: Date.now() });
      return;
    }
    if (isCalendarRelatedUrl(source) && isObject(json)) {
      capturedPayloads.push({ json, source, at: Date.now() });
    }
  }

  function installMainWorldBridge() {
    if (global.__hanatourCalendarBridgeInstalled) return;
    global.__hanatourCalendarBridgeInstalled = true;
    global.addEventListener("hanatour-calendar-capture", (event) => {
      const detail = event?.detail;
      if (!detail?.json) return;
      rememberCapture(detail.json, detail.source ?? "main_world");
    });
  }

  function installNetworkCapture() {
    if (global.__hanatourCalendarCaptureInstalled) return;
    global.__hanatourCalendarCaptureInstalled = true;

    const originalFetch = global.fetch?.bind(global);
    if (originalFetch) {
      global.fetch = async function patchedFetch(input, init) {
        const res = await originalFetch(input, init);
        try {
          const clone = res.clone();
          const json = await clone.json();
          const url =
            typeof input === "string"
              ? input
              : input && typeof input.url === "string"
                ? input.url
                : String(input);
          rememberCapture(json, `fetch:${url}`);
        } catch {
          /* not json */
        }
        return res;
      };
    }

    const XHR = global.XMLHttpRequest;
    if (XHR?.prototype) {
      const open = XHR.prototype.open;
      const send = XHR.prototype.send;
      XHR.prototype.open = function patchedOpen(method, url) {
        this.__hanatourCaptureUrl = url;
        return open.apply(this, arguments);
      };
      XHR.prototype.send = function patchedSend() {
        this.addEventListener("load", function onLoad() {
          try {
            const json = tryParseJson(this.responseText);
            rememberCapture(json, `xhr:${this.__hanatourCaptureUrl || ""}`);
          } catch {
            /* ignore */
          }
        });
        return send.apply(this, arguments);
      };
    }
  }

  function buildYearMonth() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildCandidateUrls(meta) {
    const origin = global.location?.origin || "https://www.hanatour.com";
    const sale = meta.saleProdCd;
    const rprs = meta.rprsProdCd;
    const depDay = meta.depDay;
    const ym = buildYearMonth();
    const urls = [];

    if (rprs && depDay) {
      urls.push(`${origin}/api/v1/product/calendar?rprsProdCd=${encodeURIComponent(rprs)}&depDay=${encodeURIComponent(depDay)}`);
      urls.push(`https://m.hanatour.com/api/v1/product/calendar?rprsProdCd=${encodeURIComponent(rprs)}&depDay=${encodeURIComponent(depDay)}`);
    }
    if (sale && depDay) {
      urls.push(`${origin}/api/v1/product/calendar?saleProdCd=${encodeURIComponent(sale)}&depDay=${encodeURIComponent(depDay)}`);
      urls.push(`${origin}/api/v1/product/calendar?prodCode=${encodeURIComponent(sale)}&depDay=${encodeURIComponent(depDay)}`);
    }
    if (rprs) {
      urls.push(`${origin}/api/v1/product/calendar?rprsProdCd=${encodeURIComponent(rprs)}&yearMonth=${ym}`);
      urls.push(`https://m.hanatour.com/api/v1/product/searchCalendar?prodCode=${encodeURIComponent(rprs)}`);
      urls.push(`https://m.hanatour.com/api/v1/product/calendar?prodCode=${encodeURIComponent(rprs)}&yearMonth=${ym}`);
    }
    if (sale) {
      urls.push(`${origin}/api/v1/product/calendar?prodCode=${encodeURIComponent(sale)}&yearMonth=${ym}`);
      urls.push(`https://m.hanatour.com/api/v1/product/calendar?prodCode=${encodeURIComponent(sale)}&yearMonth=${ym}`);
    }

    return [...new Set(urls)];
  }

  async function trialFetchEndpoints(meta) {
    const fetchMeta = [];
    const searchCalendar = {};
    const calendarData = [];

    for (const url of buildCandidateUrls(meta)) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          fetchMeta.push({ url, ok: false, status: res.status });
          continue;
        }
        const json = await res.json();
        if (!hasValidSearchCalendar(json)) {
          fetchMeta.push({ url, ok: false, reason: "no searchCalendar" });
          continue;
        }
        mergeSearchCalendar(searchCalendar, extractSearchCalendar(json));
        mergeCalendarData(calendarData, json?.data?.data);
        fetchMeta.push({ url, ok: true, dayCount: countCalendarDays(extractSearchCalendar(json)) });
        if (isCalendarSufficient({ searchCalendar, calendarData })) break;
      } catch (err) {
        fetchMeta.push({ url, ok: false, error: String(err) });
      }
    }

    return { searchCalendar, calendarData, fetchMeta };
  }

  function normalizeFromCaptures(captures, meta) {
    const searchCalendar = {};
    const calendarData = [];
    const sources = [];

    for (const item of captures) {
      const json = item.json ?? item;
      const cal = extractSearchCalendar(json);
      if (cal) {
        mergeSearchCalendar(searchCalendar, cal);
        sources.push(item.source || "capture");
      }
      mergeCalendarData(calendarData, json?.data?.data);
    }

    if (countCalendarDays(searchCalendar) === 0 && calendarData.length === 0) {
      return null;
    }

    return {
      prodCode: meta.saleProdCd || meta.rprsProdCd || null,
      saleProdCd: meta.saleProdCd ?? null,
      rprsProdCd: meta.rprsProdCd ?? null,
      depDay: meta.depDay ?? null,
      searchCalendar: countCalendarDays(searchCalendar) > 0 ? searchCalendar : undefined,
      calendarData: calendarData.length > 0 ? calendarData : undefined,
      fetchMeta: sources.map((s) => ({ source: s, ok: true })),
    };
  }

  async function discoverHanatourCalendar(doc, meta) {
    installNetworkCapture();

    const captures = [
      ...capturedPayloads,
      ...extractFromScripts(doc).map((json) => ({ json, source: "script" })),
      ...extractFromGlobals().map((json) => ({ json, source: "global" })),
    ];

    let result = normalizeFromCaptures(captures, meta);
    if (isCalendarSufficient(result)) {
      return result;
    }

    const trial = await trialFetchEndpoints(meta);
    if (countCalendarDays(trial.searchCalendar) > 0 || trial.calendarData.length > 0) {
      const merged = result ?? {
        prodCode: meta.saleProdCd || meta.rprsProdCd || null,
        saleProdCd: meta.saleProdCd ?? null,
        rprsProdCd: meta.rprsProdCd ?? null,
        depDay: meta.depDay ?? null,
      };
      mergeSearchCalendar(trial.searchCalendar, merged.searchCalendar || {});
      merged.searchCalendar =
        countCalendarDays(trial.searchCalendar) > 0
          ? { ...(merged.searchCalendar || {}), ...trial.searchCalendar }
          : merged.searchCalendar;
      merged.calendarData = mergeCalendarData(merged.calendarData || [], trial.calendarData);
      merged.fetchMeta = [...(merged.fetchMeta || []), ...trial.fetchMeta];
      result = merged;
    }

    if (!result || countCalendarDays(result.searchCalendar) === 0) {
      return null;
    }
    return result;
  }

  installNetworkCapture();
  installMainWorldBridge();

  global.HanatourCalendarDiscover = {
    discoverHanatourCalendar,
    hasValidSearchCalendar,
    extractSearchCalendar,
    isCalendarSufficient,
    getCapturedPayloads: () => [...capturedPayloads],
    getCapturedPayloadCount: () => capturedPayloads.length,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
