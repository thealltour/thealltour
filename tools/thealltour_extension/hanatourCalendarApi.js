/**
 * 하나투어 달력 API — DOM 없이 상품코드 기반 다월 fetch (content + service worker 공용)
 */
(function (global) {
  const API_BASE = "https://m.hanatour.com/api/v1/product/calendar";
  const DEFAULT_MONTH_COUNT = 12;
  const MIN_DAYS_FOR_SUFFICIENT = 5;
  const MIN_MONTHS_FOR_SUFFICIENT = 2;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function buildYearMonthList(count, startDate) {
    const out = [];
    const cursor = startDate ? new Date(startDate) : new Date();
    for (let i = 0; i < count; i += 1) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      out.push(`${year}${month}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
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

  function buildMonthApiUrls(meta, yearMonth) {
    const urls = [];
    const rprs = meta.rprsProdCd?.trim?.() || meta.rprsProdCd;
    const sale = meta.saleProdCd?.trim?.() || meta.saleProdCd;

    if (rprs) {
      urls.push({
        url: `${API_BASE}?rprsProdCd=${encodeURIComponent(rprs)}&yearMonth=${yearMonth}`,
        codeType: "rprsProdCd",
      });
      urls.push({
        url: `${API_BASE}?prodCode=${encodeURIComponent(rprs)}&yearMonth=${yearMonth}`,
        codeType: "prodCode_rprs",
      });
    }
    if (sale) {
      urls.push({
        url: `${API_BASE}?saleProdCd=${encodeURIComponent(sale)}&yearMonth=${yearMonth}`,
        codeType: "saleProdCd",
      });
      urls.push({
        url: `${API_BASE}?prodCode=${encodeURIComponent(sale)}&yearMonth=${yearMonth}`,
        codeType: "prodCode_sale",
      });
    }
    return urls;
  }

  async function fetchCalendarViaApi(meta, options) {
    const monthCount = options?.months ?? DEFAULT_MONTH_COUNT;
    const yearMonths = buildYearMonthList(monthCount);
    const searchCalendar = {};
    const calendarData = [];
    const fetchMeta = [];

    for (const yearMonth of yearMonths) {
      const candidates = buildMonthApiUrls(meta, yearMonth);
      if (candidates.length === 0) continue;

      let monthOk = false;
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate.url, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          if (!res.ok) {
            fetchMeta.push({
              yearMonth,
              codeType: candidate.codeType,
              ok: false,
              status: res.status,
            });
            continue;
          }

          const json = await res.json();
          const cal = json?.data?.searchCalendar;
          const hasCal = isObject(cal) && Object.keys(cal).length > 0;
          const rows = json?.data?.data;
          const hasRows = Array.isArray(rows) && rows.length > 0;

          if (!hasCal && !hasRows) {
            fetchMeta.push({
              yearMonth,
              codeType: candidate.codeType,
              ok: false,
              reason: "empty",
            });
            continue;
          }

          if (hasCal) mergeSearchCalendar(searchCalendar, cal);
          if (hasRows) mergeCalendarData(calendarData, rows);

          fetchMeta.push({ yearMonth, codeType: candidate.codeType, ok: true });
          monthOk = true;
          break;
        } catch (err) {
          fetchMeta.push({
            yearMonth,
            codeType: candidate.codeType,
            ok: false,
            error: String(err),
          });
        }
      }

      if (!monthOk) {
        fetchMeta.push({ yearMonth, ok: false, reason: "all_candidates_failed" });
      }

      if (isCalendarSufficient({ searchCalendar, calendarData })) {
        break;
      }
    }

    const hasCalendar = Object.keys(searchCalendar).length > 0 || calendarData.length > 0;
    if (!hasCalendar) return null;

    return {
      prodCode: meta.rprsProdCd || meta.saleProdCd || null,
      saleProdCd: meta.saleProdCd ?? null,
      rprsProdCd: meta.rprsProdCd ?? null,
      depDay: meta.depDay ?? null,
      searchCalendar: Object.keys(searchCalendar).length > 0 ? searchCalendar : undefined,
      calendarData: calendarData.length > 0 ? calendarData : undefined,
      fetchMeta,
    };
  }

  function mergeCalendarPayloads(a, b) {
    if (!a) return b ?? null;
    if (!b) return a;

    const searchCalendar = {};
    mergeSearchCalendar(searchCalendar, a.searchCalendar || {});
    mergeSearchCalendar(searchCalendar, b.searchCalendar || {});

    const calendarData = [];
    mergeCalendarData(calendarData, a.calendarData || []);
    mergeCalendarData(calendarData, b.calendarData || []);

    const hasSearch = Object.keys(searchCalendar).length > 0;
    const hasData = calendarData.length > 0;
    if (!hasSearch && !hasData) return null;

    return {
      prodCode: b.prodCode || a.prodCode,
      saleProdCd: b.saleProdCd ?? a.saleProdCd,
      rprsProdCd: b.rprsProdCd ?? a.rprsProdCd,
      depDay: b.depDay ?? a.depDay,
      searchCalendar: hasSearch ? searchCalendar : undefined,
      calendarData: hasData ? calendarData : undefined,
      fetchMeta: [...(a.fetchMeta || []), ...(b.fetchMeta || [])],
    };
  }

  global.HanatourCalendarApi = {
    API_BASE,
    DEFAULT_MONTH_COUNT,
    MIN_DAYS_FOR_SUFFICIENT,
    MIN_MONTHS_FOR_SUFFICIENT,
    buildYearMonthList,
    buildMonthApiUrls,
    countCalendarDays,
    countCalendarMonths,
    isCalendarSufficient,
    mergeSearchCalendar,
    mergeCalendarData,
    mergeCalendarPayloads,
    fetchCalendarViaApi,
  };
})(typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : window);
