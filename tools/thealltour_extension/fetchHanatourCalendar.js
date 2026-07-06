/**
 * 하나투어 달력 — API 우선, discover/prepare 폴백 (content script)
 */
(function (global) {
  const api = () => global.HanatourCalendarApi;

  function countCalendarDays(searchCalendar) {
    return api()?.countCalendarDays(searchCalendar) ?? 0;
  }

  function isCalendarSufficient(result) {
    return api()?.isCalendarSufficient(result) ?? false;
  }

  function mergeCalendarPayloads(a, b) {
    return api()?.mergeCalendarPayloads(a, b) ?? b ?? a ?? null;
  }

  async function fetchCalendarViaApi(meta, options) {
    const mod = api();
    if (!mod?.fetchCalendarViaApi) return null;
    return mod.fetchCalendarViaApi(meta, options);
  }

  async function fetchHanatourCalendar(prodCode, options) {
    const meta = {
      saleProdCd: options?.saleProdCd ?? prodCode ?? null,
      rprsProdCd: options?.rprsProdCd ?? null,
      depDay: options?.depDay ?? null,
    };

    let merged = await fetchCalendarViaApi(meta, options);
    if (isCalendarSufficient(merged)) {
      return {
        ...merged,
        fetchMeta: [{ source: "api_direct", ok: true }, ...(merged.fetchMeta || [])],
      };
    }

    const discover = global.HanatourCalendarDiscover?.discoverHanatourCalendar;
    if (typeof discover === "function" && typeof document !== "undefined") {
      const discovered = await discover(document, meta);
      merged = mergeCalendarPayloads(merged, discovered);
      if (isCalendarSufficient(merged)) return merged;
    }

    const prepare = global.HanatourCalendarOpen?.prepareHanatourCalendar;
    if (typeof prepare === "function" && typeof document !== "undefined") {
      const prepared = await prepare(document, meta);
      merged = mergeCalendarPayloads(merged, prepared);
    }

    if (
      !merged ||
      (countCalendarDays(merged.searchCalendar) === 0 &&
        !(Array.isArray(merged.calendarData) && merged.calendarData.length > 0))
    ) {
      return null;
    }

    return merged;
  }

  global.HanatourCalendarFetch = {
    buildYearMonthList: (...args) => api()?.buildYearMonthList(...args),
    buildMonthApiUrls: (...args) => api()?.buildMonthApiUrls(...args),
    countCalendarDays: (...args) => api()?.countCalendarDays(...args),
    countCalendarMonths: (...args) => api()?.countCalendarMonths(...args),
    isCalendarSufficient,
    fetchCalendarViaApi,
    mergeCalendarPayloads,
    fetchHanatourCalendar,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
