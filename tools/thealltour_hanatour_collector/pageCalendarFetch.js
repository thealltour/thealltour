/**
 * 상품 탭 컨텍스트에서 1년치 캘린더 수집:
 * discover 캡처 → POST getListYearMonthCal → m.hanatour GET merge
 */
(function (global) {
  const YEAR_MONTH_CAL_URL = "https://www.hanatour.com/api/package/getListYearMonthCal";

  function merge(a, b) {
    return global.HanatourCalendarApi?.mergeCalendarPayloads(a, b) ?? b ?? a ?? null;
  }

  function countDays(searchCalendar) {
    return (
      global.HanatourCollectorCore?.countSearchCalendarDays(searchCalendar) ??
      global.HanatourCalendarApi?.countCalendarDays(searchCalendar) ??
      0
    );
  }

  async function fetchYearMonthCalInPage(rprsProdCd, options) {
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
    const searchCalendar =
      core?.resolveSearchCalendarFromApiResponse(json) ?? core?.normalizeYearMonthCalJson(json) ?? null;
    const calendarData = Array.isArray(json?.data?.data)
      ? json.data.data
      : Array.isArray(json?.calList)
        ? json.calList
        : [];
    return {
      prodCode: rprsProdCd,
      rprsProdCd,
      searchCalendar: searchCalendar || undefined,
      calendarData: calendarData.length > 0 ? calendarData : undefined,
      raw: json,
      fetchMeta: [
        {
          source: "getListYearMonthCal",
          ok: Boolean(searchCalendar) || calendarData.length > 0,
          strtYearMonth: body.strtYearMonth,
          endYearMonth: body.endYearMonth,
          dayCount: countDays(searchCalendar),
        },
      ],
      source: "getListYearMonthCal",
    };
  }

  function appendFetchMeta(payload, extra) {
    const rows = Array.isArray(extra) ? extra : extra ? [extra] : [];
    if (!payload) {
      return { fetchMeta: rows };
    }
    return { ...payload, fetchMeta: [...(payload.fetchMeta || []), ...rows] };
  }

  async function fetchHanatourCalendarInPage(meta, options) {
    const monthSpan = options?.monthSpan ?? 12;
    let merged = null;
    const sources = [];

    const discover = global.HanatourCalendarDiscover?.discoverHanatourCalendar;
    if (typeof discover === "function" && typeof document !== "undefined") {
      try {
        const discovered = await discover(document, meta);
        if (discovered) {
          merged = merge(merged, { ...discovered, source: "discover" });
          sources.push("discover");
        }
      } catch (err) {
        console.warn("[hanatour-collector] discover calendar failed:", err);
        merged = appendFetchMeta(merged, {
          source: "discover",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (meta?.rprsProdCd) {
      try {
        const posted = await fetchYearMonthCalInPage(meta.rprsProdCd, { monthSpan });
        merged = merge(merged, posted);
        sources.push("getListYearMonthCal");
      } catch (err) {
        console.warn("[hanatour-collector] getListYearMonthCal failed:", err);
        merged = appendFetchMeta(merged, {
          source: "getListYearMonthCal",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      merged = appendFetchMeta(merged, { source: "getListYearMonthCal", ok: false, reason: "missing_rprsProdCd" });
    }

    const api = global.HanatourCalendarApi;
    if (api?.fetchCalendarViaApi) {
      try {
        const viaApi = await api.fetchCalendarViaApi(meta, { months: monthSpan });
        if (viaApi) {
          merged = merge(merged, { ...viaApi, source: "m_hanatour_calendar_get" });
          sources.push("m_hanatour_calendar_get");
        }
      } catch (err) {
        console.warn("[hanatour-collector] m.hanatour calendar GET failed:", err);
      }
    }

    const dayCount = countDays(merged?.searchCalendar);
    const dataCount = Array.isArray(merged?.calendarData) ? merged.calendarData.length : 0;
    const source = sources.length > 0 ? sources.join("+") : "none";

    console.log(
      `[Scrape] Calendar Months: ${Object.keys(merged?.searchCalendar ?? {}).join(", ") || "(none)"}`,
    );
    console.log("[Scrape] calendar days:", dayCount, "calendarData:", dataCount, "source:", source);

    if (!merged || (dayCount === 0 && dataCount === 0)) {
      return {
        prodCode: meta?.rprsProdCd || meta?.saleProdCd || null,
        saleProdCd: meta?.saleProdCd ?? null,
        rprsProdCd: meta?.rprsProdCd ?? null,
        depDay: meta?.depDay ?? null,
        searchCalendar: undefined,
        calendarData: undefined,
        fetchMeta: merged?.fetchMeta ?? [],
        source: "none",
      };
    }

    return {
      ...merged,
      prodCode: merged.rprsProdCd || merged.prodCode || meta?.rprsProdCd || meta?.saleProdCd || null,
      saleProdCd: merged.saleProdCd ?? meta?.saleProdCd ?? null,
      rprsProdCd: merged.rprsProdCd ?? meta?.rprsProdCd ?? null,
      depDay: merged.depDay ?? meta?.depDay ?? null,
      source,
    };
  }

  global.HanatourPageCalendarFetch = {
    YEAR_MONTH_CAL_URL,
    fetchYearMonthCalInPage,
    fetchHanatourCalendarInPage,
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
