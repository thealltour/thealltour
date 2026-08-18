/**

 * 하나투어 크로스 탭 달력 — 인접(왼쪽/opener) 탭 searchCalendar → 상세 탭

 */

(function (global) {

  const PARENT_LISTENER_FLAG = "__hanatourParentCalendarListenerInstalled";

  const WALK_MAX_DEPTH = 12;



  function isObject(value) {

    return Boolean(value) && typeof value === "object" && !Array.isArray(value);

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



  function countCalendarDays(searchCalendar) {

    if (!isObject(searchCalendar)) return 0;

    let count = 0;

    for (const rows of Object.values(searchCalendar)) {

      if (Array.isArray(rows)) count += rows.length;

    }

    return count;

  }



  function applyVisibleMonthFilter(searchCalendar, doc) {

    if (!searchCalendar) return null;

    const filter = global.HanatourCalendarFilter;

    if (filter?.applyVisibleMonthFilter) {

      return filter.applyVisibleMonthFilter(searchCalendar, doc);

    }

    return searchCalendar;

  }



  function isHanatourDetailPage(url) {

    const href = (url || global.location?.href || "").toLowerCase();

    if (href.includes("/trp/pkg/")) return true;

    try {

      const params = new URL(href, "https://www.hanatour.com").searchParams;

      return Boolean(params.get("pkgcd") || params.get("pkgCd")) && Boolean(params.get("depday") || params.get("depDay"));

    } catch {

      return false;

    }

  }



  function isHanatourSearchPage(url, doc) {

    const href = (url || global.location?.href || "").toLowerCase();

    if (href.includes("/all-search")) return true;

    if (href.includes("allsearchtab=package")) return true;

    if (href.includes("/search")) return true;

    if (/chpc0pkg\d+m\d+/i.test(href) && !href.includes("/trp/pkg/")) return true;

    // 일정수집용 부모탭(예: /package/major-products?rprsProdCds=...)도 검색/리스트
    // 탭으로 인정한다.
    if (/\/package\//.test(href) && href.includes("rprsprodcds=")) return true;

    if (!doc) return false;

    return Boolean(

      doc.querySelector(

        ".search-result-container, .search-result, .pkg_search, .calendar-container, [class*='searchResult']",

      ),

    );

  }



  function extractSearchCalendarFromJson(json) {

    const discover = global.HanatourCalendarDiscover;

    if (discover?.extractSearchCalendar) {

      return discover.extractSearchCalendar(json);

    }

    if (!isObject(json)) return null;

    const fromData = json.data?.searchCalendar;

    if (isObject(fromData) && Object.keys(fromData).length > 0) return fromData;

    const root = json.searchCalendar;

    if (isObject(root) && Object.keys(root).length > 0) return root;

    return null;

  }



  function walkForSearchCalendar(node, depth, found) {

    if (depth > WALK_MAX_DEPTH || node == null) return;

    if (typeof node === "string") {

      try {

        const parsed = JSON.parse(node.trim());

        const cal = extractSearchCalendarFromJson(parsed);

        if (cal) found.push(cal);

      } catch {

        /* ignore */

      }

      return;

    }

    if (!isObject(node) && !Array.isArray(node)) return;



    const direct = extractSearchCalendarFromJson(node);

    if (direct) found.push(direct);



    const children = Array.isArray(node) ? node.slice(0, 60) : Object.values(node).slice(0, 50);

    for (const child of children) {

      walkForSearchCalendar(child, depth + 1, found);

    }

  }



  function collectNuxtRoots() {

    const roots = [];

    const nuxt = global.__NUXT__;

    if (nuxt) {

      roots.push(nuxt, nuxt.state, nuxt.data, nuxt.payload);

    }

    try {

      const app = global.useNuxtApp?.();

      if (app?.payload) roots.push(app.payload);

      if (app?.$pinia?.state?.value) roots.push(app.$pinia.state.value);

    } catch {

      /* ignore */

    }

    return roots.filter(Boolean);

  }



  function extractParentSearchCalendar(doc, _options) {

    const merged = {};



    const captures = global.HanatourCalendarDiscover?.getCapturedPayloads?.() ?? [];

    for (const item of captures) {

      const json = item?.json ?? item;

      const cal = extractSearchCalendarFromJson(json);

      if (cal) mergeSearchCalendar(merged, cal);

    }



    const roots = [

      global.__INITIAL_STATE__,

      global.__NEXT_DATA__,

      global.__NEXT_DATA__?.props?.pageProps,

      global.__PRELOADED_STATE__,

      ...collectNuxtRoots(),

    ];

    for (const root of roots) {

      const found = [];

      walkForSearchCalendar(root, 0, found);

      for (const cal of found) mergeSearchCalendar(merged, cal);

    }



    for (const script of doc.querySelectorAll("script")) {

      const text = script.textContent || "";

      if (!text.includes("searchCalendar")) continue;

      const idx = text.indexOf('"searchCalendar"');

      if (idx < 0) continue;

      const slice = text.slice(Math.max(0, idx - 200), idx + 12000);

      try {

        const parsed = JSON.parse(`{${slice}`);

        const cal = extractSearchCalendarFromJson(parsed);

        if (cal) mergeSearchCalendar(merged, cal);

      } catch {

        /* ignore */

      }

    }



    if (countCalendarDays(merged) === 0) {

      const horizontal = global.HanatourCalendarOpen?.scrapeAllSearchHorizontalCalendar?.(doc);

      if (horizontal) mergeSearchCalendar(merged, horizontal);

    }



    if (countCalendarDays(merged) === 0) return null;

    // 데이터 완전성 우선: 보이는 달로 축소하지 않고 수집된 전체 searchCalendar를 반환한다.

    return merged;

  }



  function buildPayloadFromParentSearchCalendar(searchCalendar, productCodes, relayMeta, calendarData) {

    const pagingMetaExt = searchCalendar?.__fetchMetaExtensions;
    const cleanCalendar =
      searchCalendar && typeof searchCalendar === "object"
        ? { ...searchCalendar }
        : searchCalendar;

    if (cleanCalendar && typeof cleanCalendar === "object") {
      delete cleanCalendar.__dateStripPagingMeta;
      delete cleanCalendar.__fetchMetaExtensions;
    }

    const hasSearch = cleanCalendar && countCalendarDays(cleanCalendar) > 0;

    const hasData = Array.isArray(calendarData) && calendarData.length > 0;

    if (!hasSearch && !hasData) return null;

    const fetchMeta = [

      {

        source: relayMeta?.source ?? "parent_tab",

        ok: true,

        parentTabId: relayMeta?.parentTabId ?? undefined,

        triedTabIds: relayMeta?.triedTabIds ?? undefined,

      },

    ];

    if (Array.isArray(pagingMetaExt) && pagingMetaExt.length > 0) {
      fetchMeta.push(...pagingMetaExt);
    }

    return {

      prodCode: productCodes?.rprsProdCd || productCodes?.saleProdCd || null,

      saleProdCd: productCodes?.saleProdCd ?? null,

      rprsProdCd: productCodes?.rprsProdCd ?? null,

      depDay: productCodes?.depDay ?? null,

      searchCalendar: hasSearch ? cleanCalendar : undefined,

      calendarData: hasData ? calendarData : undefined,

      fetchMeta,

    };

  }



  function installParentCalendarResponder() {

    if (global[PARENT_LISTENER_FLAG]) return;

    if (!/hanatour\.com/i.test(global.location?.hostname ?? "")) return;



    global[PARENT_LISTENER_FLAG] = true;



    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

      if (message?.type === "GET_ACTIVE_CALENDAR") {
        const respond = (searchCalendar) => {
          if (searchCalendar) {
            const pagingMeta = global.HanatourCalendarOpen?.getLastDateStripPagingMeta?.();
            const fetchMeta = pagingMeta
              ? [
                  {
                    source: "date_strip_paging",
                    ok: (pagingMeta.clicks ?? 0) > 0,
                    clicks: pagingMeta.clicks ?? 0,
                    maxDaySeen: pagingMeta.maxDaySeen ?? 0,
                    reason: pagingMeta.reason ?? null,
                  },
                ]
              : undefined;
            sendResponse({
              ok: true,
              searchCalendar,
              dayCount: countCalendarDays(searchCalendar),
              visibleYearMonth:
                global.HanatourCalendarFilter?.findVisibleYearMonthInDocument?.(document) ?? null,
              fetchMeta,
            });
          } else {
            sendResponse({ ok: false, reason: "searchCalendar not found in tab" });
          }
        };

        const open = global.HanatourCalendarOpen;
        const paging = open?.scrapeAllSearchHorizontalCalendarWithPaging;
        if (typeof paging === "function") {
          paging(document, { tabId: message.tabId ?? null })
            .then((paged) => {
              if (paged && countCalendarDays(paged) > 0) {
                // 데이터 완전성 우선: 페이징으로 모은 여러 달을 보이는 달로 축소하지 않고 그대로 전달.
                respond(paged);
                return;
              }
              respond(extractParentSearchCalendar(document));
            })
            .catch(() => respond(extractParentSearchCalendar(document)));
        } else {
          respond(extractParentSearchCalendar(document));
        }
        return true;
      }



      if (message?.type === "BROWSE_CALENDAR_MONTHS") {

        const browse = global.HanatourCalendarBrowse?.browseHanatourCalendarMonths;

        if (typeof browse !== "function") {

          sendResponse({ ok: false, error: "browse module not loaded" });

          return true;

        }

        browse(document, { maxMonths: message.maxMonths ?? 12, tabId: message.tabId ?? null })

          .then((searchCalendar) => {

            if (!searchCalendar || countCalendarDays(searchCalendar) === 0) {

              sendResponse({ ok: false, reason: "no calendar after browse" });

              return;

            }

            const pagingFetchMeta = searchCalendar.__fetchMetaExtensions ?? [];
            const cleanCalendar = { ...searchCalendar };
            delete cleanCalendar.__dateStripPagingMeta;
            delete cleanCalendar.__fetchMetaExtensions;

            sendResponse({

              ok: true,

              searchCalendar: cleanCalendar,

              dayCount: countCalendarDays(cleanCalendar),

              source: "parent_tab_browse",

              fetchMeta: pagingFetchMeta,

            });

          })

          .catch((err) => sendResponse({ ok: false, error: String(err) }));

        return true;

      }



      return false;

    });

  }



  function registerChildTab() {

    return new Promise((resolve) => {

      chrome.runtime.sendMessage({ type: "REGISTER_CHILD" }, (response) => {

        if (chrome.runtime.lastError) {

          resolve({ ok: false, error: chrome.runtime.lastError.message });

          return;

        }

        resolve(response ?? { ok: true });

      });

    });

  }



  function requestParentCalendarViaBackground(productCodes, options) {

    return new Promise((resolve) => {

      chrome.runtime.sendMessage(

        {

          type: "REQUEST_PARENT_CALENDAR",

          meta: {

            saleProdCd: productCodes?.saleProdCd ?? null,

            rprsProdCd: productCodes?.rprsProdCd ?? null,

            depDay: productCodes?.depDay ?? null,

          },

          browseMonths: options?.browseMonths ?? 0,

        },

        (response) => {

          if (chrome.runtime.lastError) {

            resolve({ ok: false, error: chrome.runtime.lastError.message });

            return;

          }

          resolve(response ?? { ok: false, error: "empty response" });

        },

      );

    });

  }



  async function fetchParentTabCalendar(productCodes, options) {

    if (!isHanatourDetailPage(global.location?.href)) {

      return { payload: null, error: "not_detail_page" };

    }



    await registerChildTab();



    const response = await requestParentCalendarViaBackground(productCodes, options);

    const hasCalendar =

      response?.ok &&

      (countCalendarDays(response.searchCalendar) > 0 ||

        (Array.isArray(response.calendarData) && response.calendarData.length > 0));

    if (!hasCalendar) {

      return {

        payload: null,

        error: response?.error ?? response?.reason ?? "parent_unavailable",

        triedTabIds: response?.triedTabIds ?? null,

        parentTabId: response?.parentTabId ?? null,

      };

    }



    const payload = buildPayloadFromParentSearchCalendar(

      response.searchCalendar,

      productCodes,

      {

        parentTabId: response.parentTabId,

        triedTabIds: response.triedTabIds,

        source: response.source,

      },

      response.calendarData,

    );

    if (payload && Array.isArray(response.fetchMeta) && response.fetchMeta.length > 0) {
      payload.fetchMeta = [...(payload.fetchMeta || []), ...response.fetchMeta];
    }

    return { payload, parentTabId: response.parentTabId ?? null, triedTabIds: response.triedTabIds ?? null };

  }



  global.HanatourCrossTabCalendar = {

    isHanatourSearchPage,

    isHanatourDetailPage,

    extractParentSearchCalendar,

    buildPayloadFromParentSearchCalendar,

    installParentCalendarResponder,

    registerChildTab,

    requestParentCalendarViaBackground,

    fetchParentTabCalendar,

    countCalendarDays,

    applyVisibleMonthFilter,

  };

})(typeof globalThis !== "undefined" ? globalThis : window);

