/**
 * 하나투어 월별 캘린더 — POST getListYearMonthCal, 실패 시 m.hanatour.com GET 폴백
 */
(function (global) {
  const YEAR_MONTH_CAL_URL = "https://www.hanatour.com/api/package/getListYearMonthCal";

  async function fetchYearMonthCal(rprsProdCd, options) {
    const core = global.HanatourCollectorCore;
    const range = core?.buildYearMonthRange(options?.startDate ?? new Date(), options?.monthSpan ?? 12) ?? {
      strtYearMonth: null,
      endYearMonth: null,
    };
    const body = {
      rprsProdCd,
      strtYearMonth: options?.strtYearMonth ?? range.strtYearMonth,
      endYearMonth: options?.endYearMonth ?? range.endYearMonth,
      _siteId: "hanatour",
    };

    const res = await fetch(YEAR_MONTH_CAL_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = new Error(`getListYearMonthCal HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    const searchCalendar = core?.resolveSearchCalendarFromApiResponse(json) ?? core?.normalizeYearMonthCalJson(json) ?? null;
    return {
      ok: Boolean(searchCalendar),
      source: "getListYearMonthCal",
      request: body,
      searchCalendar,
      raw: json,
    };
  }

  async function fetchCalendarWithFallback(meta, options) {
    const rprs = meta?.rprsProdCd?.trim?.() || meta?.rprsProdCd || null;
    const fetchMeta = [];
    let searchCalendar = null;

    if (rprs) {
      try {
        const posted = await fetchYearMonthCal(rprs, options);
        fetchMeta.push({
          source: "getListYearMonthCal",
          ok: posted.ok,
          strtYearMonth: posted.request.strtYearMonth,
          endYearMonth: posted.request.endYearMonth,
        });
        if (posted.searchCalendar) searchCalendar = posted.searchCalendar;
      } catch (err) {
        fetchMeta.push({
          source: "getListYearMonthCal",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      fetchMeta.push({ source: "getListYearMonthCal", ok: false, reason: "missing_rprsProdCd" });
    }

    const dayCount = global.HanatourCollectorCore?.countSearchCalendarDays(searchCalendar) ?? 0;
    if (dayCount > 0) {
      return {
        prodCode: rprs || meta?.saleProdCd || null,
        saleProdCd: meta?.saleProdCd ?? null,
        rprsProdCd: rprs,
        depDay: meta?.depDay ?? null,
        searchCalendar,
        raw: posted.raw,
        fetchMeta,
        source: "getListYearMonthCal",
      };
    }

    const api = global.HanatourCalendarApi;
    if (api?.fetchCalendarViaApi) {
      try {
        const fallback = await api.fetchCalendarViaApi(meta, { months: options?.monthSpan ?? 12 });
        if (fallback) {
          fetchMeta.push({
            source: "m_hanatour_calendar_get",
            ok: true,
            dayCount: api.countCalendarDays?.(fallback.searchCalendar) ?? 0,
          });
          return {
            ...fallback,
            fetchMeta: [...(fallback.fetchMeta || []), ...fetchMeta],
            source: "m_hanatour_calendar_get",
          };
        }
        fetchMeta.push({ source: "m_hanatour_calendar_get", ok: false, reason: "empty" });
      } catch (err) {
        fetchMeta.push({
          source: "m_hanatour_calendar_get",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      prodCode: rprs || meta?.saleProdCd || null,
      saleProdCd: meta?.saleProdCd ?? null,
      rprsProdCd: rprs,
      depDay: meta?.depDay ?? null,
      searchCalendar: undefined,
      fetchMeta,
      source: "none",
    };
  }

  global.HanatourYearMonthCal = {
    YEAR_MONTH_CAL_URL,
    fetchYearMonthCal,
    fetchCalendarWithFallback,
  };
})(typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : window);
