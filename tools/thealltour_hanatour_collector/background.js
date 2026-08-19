importScripts("hanatourCollectorCore.js", "hanatourCalendarApi.js", "hanatourYearMonthCal.js");

const PRODUCTION_API_BASE = "https://www.thealltour.com";
const PRODUCTION_API_BASE_ALIASES = ["https://thealltour.com", "https://www.thealltour.com"];
const LOCAL_API_BASE = "http://localhost:3000";
const IMPORT_TIMEOUT_MS = 280_000;

function normalizeApiBaseUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/$/, "");
}

function isLocalApiBase(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function isDevelopmentInstall() {
  try {
    const selfInfo = await chrome.management.getSelf();
    return selfInfo.installType === "development";
  } catch {
    return false;
  }
}

async function resolveDefaultApiBaseUrl() {
  if (await isDevelopmentInstall()) return LOCAL_API_BASE;
  return PRODUCTION_API_BASE;
}

async function migrateApiBaseUrlIfNeeded() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl"]);
  const value = typeof stored.apiBaseUrl === "string" ? stored.apiBaseUrl.trim() : "";
  const defaultUrl = await resolveDefaultApiBaseUrl();
  const dev = await isDevelopmentInstall();

  if (!value) {
    await chrome.storage.sync.set({ apiBaseUrl: defaultUrl });
    return defaultUrl;
  }

  const normalized = normalizeApiBaseUrl(value);
  if (!dev && isLocalApiBase(normalized)) {
    await chrome.storage.sync.set({ apiBaseUrl: defaultUrl });
    return defaultUrl;
  }
  if (!dev && normalized === "https://thealltour.com") {
    await chrome.storage.sync.set({ apiBaseUrl: PRODUCTION_API_BASE });
    return PRODUCTION_API_BASE;
  }
  return normalized;
}

async function getApiBaseUrl() {
  return migrateApiBaseUrlIfNeeded();
}

async function setApiBaseUrl(url) {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) throw new Error("API Base URL이 비어 있습니다.");
  await chrome.storage.sync.set({ apiBaseUrl: normalized });
  return normalized;
}

function isHanatourMajorProductsUrl(url) {
  try {
    const u = new URL(url);
    const isMajor = /\/package\/major-products/i.test(u.pathname);
    if (!isMajor) return false;
    // 대표코드는 rprsProdCds(복수) / selectedRprsProd 등을 포함해 전달되는 경우가 많습니다.
    const rprs =
      u.searchParams.get("rprsProdCds") ||
      u.searchParams.get("selectedRprsProd") ||
      u.searchParams.get("rprsProdCd");
    return Boolean(rprs);
  } catch {
    return false;
  }
}

function extractStartYearMonthFromUrl(url) {
  try {
    const u = new URL(url);
    const strt = u.searchParams.get("strtDepDay");
    if (strt && /^\d{8}$/.test(strt)) return strt.slice(0, 6);
  } catch {
    /* ignore */
  }
  return null;
}

function productionApiBaseCandidates(preferred) {
  const normalized = normalizeApiBaseUrl(preferred);
  const out = [];
  const push = (url) => {
    if (url && !out.includes(url)) out.push(url);
  };
  push(normalized);
  if (PRODUCTION_API_BASE_ALIASES.includes(normalized)) {
    for (const alias of PRODUCTION_API_BASE_ALIASES) push(alias);
  }
  return out;
}

/** 로그인 쿠키는 호스트별(thealltour.com ≠ www.thealltour.com)이라 API Base와 정확히 맞는지 확인한다. */
async function probeAdminSession(apiBase) {
  const url = `${normalizeApiBaseUrl(apiBase)}/api/admin/products/import-external`;
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.status !== 401;
  } catch {
    return false;
  }
}

async function resolveApiBaseForAuth(preferred) {
  const candidates = productionApiBaseCandidates(preferred);
  for (const base of candidates) {
    if (await probeAdminSession(base)) {
      if (base !== normalizeApiBaseUrl(preferred)) {
        await setApiBaseUrl(base);
      }
      return { apiBase: base, authenticated: true, switchedFrom: preferred !== base ? preferred : null };
    }
  }
  return { apiBase: normalizeApiBaseUrl(preferred), authenticated: false, switchedFrom: null };
}

async function checkAdminAuth(apiBase) {
  const preferred = normalizeApiBaseUrl(apiBase || (await getApiBaseUrl()));
  const resolved = await resolveApiBaseForAuth(preferred);
  if (resolved.authenticated) {
    return {
      ok: true,
      authenticated: true,
      apiBaseUrl: resolved.apiBase,
      switchedFrom: resolved.switchedFrom,
      message: resolved.switchedFrom
        ? `관리자 로그인 확인 (${resolved.apiBase}). API Base를 ${resolved.switchedFrom} → ${resolved.apiBase} 로 맞췄습니다.`
        : `관리자 로그인 확인 (${resolved.apiBase})`,
    };
  }

  const tried = productionApiBaseCandidates(preferred);
  const hostHint =
    tried.length > 1
      ? `\n\n브라우저 주소창의 www 유무가 API Base와 다르면 쿠키가 전달되지 않습니다.\n시도한 호스트: ${tried.join(", ")}\n관리자: ${preferred}/theall_manager_only`
      : `\n\n관리자: ${preferred}/theall_manager_only`;

  return {
    ok: true,
    authenticated: false,
    apiBaseUrl: preferred,
    triedHosts: tried,
    message: `관리자 로그인이 이 API Base 호스트에서 확인되지 않습니다.${hostHint}`,
  };
}

/** @type {{ running: boolean, percent: number, label: string, result: object | null, error: string | null, tabId: number | null }} */
let importState = {
  running: false,
  percent: 0,
  label: "대기 중",
  result: null,
  error: null,
  tabId: null,
};

function snapshotState() {
  return { ...importState };
}

function broadcastState() {
  chrome.runtime.sendMessage({ type: "IMPORT_STATE", state: snapshotState() }).catch(() => {
    /* popup closed */
  });
}

// 페이지 위에 떠 있던 진행률 오버레이(우하단 고정 박스)는 팝업 자체 진행률 표시와
// 중복되어 요청에 따라 제거했다. 팝업(runBtn 클릭 시 뜨는 작은 창)이 label·percent·
// 요약을 모두 보여주므로 페이지에 별도로 그릴 필요가 없다.
async function setProgress(percent, label) {
  importState.percent = percent;
  importState.label = label;
  broadcastState();
}

async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return { ok: false, reason: "no_tab", tab: null, isProductPage: false, isCalendarPage: false };
  }
  const isProductPage = Boolean(self.HanatourCollectorCore?.isHanatourProductPageUrl(tab.url));
  const isCalendarPage = isHanatourMajorProductsUrl(tab.url);
  const codes = self.HanatourCollectorCore?.parseProductCodesFromHref(tab.url) ?? {
    saleProdCd: null,
    rprsProdCd: null,
    depDay: null,
  };
  return {
    ok: true,
    tab: { id: tab.id, url: tab.url, title: tab.title ?? "" },
    isProductPage,
    isCalendarPage,
    codes,
  };
}

const SCRAPE_FILES = [
  "hanatourCollectorCore.js",
  "extractProductCode.js",
  "hanatourItineraryUiPrep.js",
  "htmlContextExtract.js",
  "itineraryDomExtract.js",
  "packageCatalogExtract.js",
  "lightScrape.js",
];

const CALENDAR_FILES = [
  "hanatourCollectorCore.js",
  "extractProductCode.js",
  "hanatourCalendarApi.js",
  "pageCalendarFetch.js",
];

async function scrapeTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: SCRAPE_FILES,
  });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      if (typeof scrapeHanatourLightPage !== "function") return null;
      return await scrapeHanatourLightPage();
    },
  });
  return result?.result ?? null;
}

async function findRprsFromSiblingTabs(productTab) {
  if (!productTab?.windowId) return null;
  const tabs = await chrome.tabs.query({ windowId: productTab.windowId });
  const core = self.HanatourCollectorCore;
  for (const sibling of tabs) {
    if (!sibling.url || sibling.id === productTab.id) continue;
    const codes = core?.parseProductCodesFromHref?.(sibling.url);
    if (codes?.rprsProdCd) return codes.rprsProdCd;
  }
  return null;
}

async function fetchCalendarInTab(tabId, meta) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: CALENDAR_FILES,
  });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (pageMeta) => {
      const api = globalThis.HanatourPageCalendarFetch;
      if (!api?.fetchHanatourCalendarInPage) return null;
      return await api.fetchHanatourCalendarInPage(pageMeta, { monthSpan: 12 });
    },
    args: [meta],
  });
  return result?.result ?? null;
}

// major-products(부모탭) 전용 DOM 월/일 순회 스크래퍼.
// 단순 셀렉터 추측(예전 parentCalendarDomScrape.js)이 실제 하나투어 마크업과 맞지 않아
// 0건만 나오던 문제를, thealltour_extension에서 검증된 모듈(월 헤더/날짜 스트립을
// 텍스트·구조·geometry 기반으로 탐지)을 이식해 대체한다. maxDateStripClicks는 실측
// 최대치인 3회로 고정되어 있다(openHanatourCalendar.js 참고).
const CALENDAR_DOM_BROWSE_FILES = [
  "discoverHanatourCalendar.js",
  "hanatourCalendarFilter.js",
  "openHanatourCalendar.js",
  "browseHanatourCalendarMonths.js",
];

// 백그라운드(비활성) 탭은 크롬이 타이머를 강하게 throttling한다(setTimeout이 실제
// 요청 시간보다 훨씬 오래 걸릴 수 있음). DOM 월/일 순회는 sleep()을 매우 많이 호출하므로
// 비활성 탭에서 실행하면 로직상 10~20초면 끝날 작업이 실제로는 분 단위로 늘어나
// 안전망 deadline(150초)에 조기 도달해버린다. 순회 전 해당 탭/창을 잠깐 활성화하고,
// 종료 후 원래 활성 탭으로 복구한다.
async function withTabFocused(tabId, fn) {
  let originalActiveTabId = null;
  let originalWindowId = null;
  try {
    const targetTab = await chrome.tabs.get(tabId);
    const [originalActiveTab] = await chrome.tabs.query({
      active: true,
      windowId: targetTab.windowId,
    });
    originalActiveTabId = originalActiveTab?.id ?? null;
    originalWindowId = targetTab.windowId ?? null;

    if (originalWindowId != null) {
      await chrome.windows.update(originalWindowId, { focused: true }).catch(() => {});
    }
    if (!targetTab.active) {
      await chrome.tabs.update(tabId, { active: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[CalendarOverride] 탭 활성화 실패(계속 진행):", err?.message ?? err);
  }

  try {
    return await fn();
  } finally {
    if (originalActiveTabId != null && originalActiveTabId !== tabId) {
      await chrome.tabs.update(originalActiveTabId, { active: true }).catch(() => {});
    }
  }
}

async function scrapeCalendarFromParentDomInTab(tabId, maxMonths = 12, startYearMonth = null) {
  return withTabFocused(tabId, () => scrapeCalendarFromParentDomInTabRaw(tabId, maxMonths, startYearMonth));
}

async function scrapeCalendarFromParentDomInTabRaw(tabId, maxMonths = 12, startYearMonth = null) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: CALENDAR_DOM_BROWSE_FILES,
  });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (months, startYm) => {
      const browse = globalThis.HanatourCalendarBrowse?.browseHanatourCalendarMonths;
      if (typeof browse !== "function") {
        console.warn("[DOM Browse] HanatourCalendarBrowse 모듈이 로드되지 않았습니다.");
        return null;
      }
      try {
        const searchCalendar = await browse(document, { maxMonths: months, startYearMonth: startYm });
        if (!searchCalendar) {
          console.warn("[DOM Browse] browseHanatourCalendarMonths 결과 없음");
          return null;
        }
        const fetchMeta = Array.isArray(searchCalendar.__fetchMetaExtensions)
          ? searchCalendar.__fetchMetaExtensions
          : [];
        const clean = { ...searchCalendar };
        delete clean.__dateStripPagingMeta;
        delete clean.__fetchMetaExtensions;
        delete clean.__deadlineHit;
        delete clean.__duplicateDetected;
        console.log("[DOM Browse] months collected:", Object.keys(clean), "fetchMeta:", fetchMeta);
        return { searchCalendar: clean, fetchMeta };
      } catch (err) {
        console.warn("[DOM Browse] failed:", err);
        return null;
      }
    },
    args: [maxMonths, startYearMonth],
  });
  return result?.result ?? null;
}

async function importExternal(payload, apiBase) {
  const url = `${apiBase}/api/admin/products/import-external`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { status: res.status, data, url };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function collectProductData(tabId, onProgress, opts) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? "";
  const isProductPage = Boolean(self.HanatourCollectorCore?.isHanatourProductPageUrl(url));
  const isCalendarPage = isHanatourMajorProductsUrl(url);
  if (!isProductPage && !isCalendarPage) throw new Error("하나투어 페이지에서만 수집할 수 있습니다.");
  const calendarOnly = Boolean(opts?.calendarOnly) && isCalendarPage && !isProductPage;
  const calendarTabId = opts?.calendarTabId ?? tabId;
  const rprsProdCdsOverride = Array.isArray(opts?.rprsProdCds)
    ? opts.rprsProdCds.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];

  // 상세페이지(활성 탭)에서 실행 중이어도 왼쪽 major-products 탭(calendarTabId)이 별도로
  // 있을 수 있다. DOM 순회 폴백은 "활성 탭"이 아니라 "실제로 달력 API를 호출한 탭"이
  // major-products인지로 판정해야 한다(그렇지 않으면 상세페이지에서 실행했을 때 폴백이
  // 아예 트리거되지 않는다).
  let calendarTabUrl = url;
  if (calendarTabId !== tabId) {
    try {
      const calendarTab = await chrome.tabs.get(calendarTabId);
      calendarTabUrl = calendarTab?.url ?? "";
    } catch (err) {
      console.warn("[CalendarOverride] calendarTabId 조회 실패:", err);
      calendarTabUrl = "";
    }
  }
  const calendarTabIsMajorProducts = isHanatourMajorProductsUrl(calendarTabUrl);

  const urlCodes = self.HanatourCollectorCore.parseProductCodesFromHref(url);

  if (rprsProdCdsOverride.length) {
    console.log(
      "[CalendarOverride] codes:",
      rprsProdCdsOverride,
      "calendarTabId:",
      calendarTabId,
      "calendarTabUrl:",
      calendarTabUrl,
      "calendarTabIsMajorProducts:",
      calendarTabIsMajorProducts,
    );
  }

  let scraped = null;
  if (!calendarOnly) {
    await onProgress?.(12, "탭·일정 펼치는 중…");
    scraped = await scrapeTab(tabId);
    if (!scraped?.rawHtmlText?.trim() && !scraped?.cleanHtmlStructure?.trim()) {
      throw new Error("페이지 텍스트를 수집하지 못했습니다.");
    }
  } else {
    // major-products(부모탭)에서는 일정/포함내역까지 파싱이 필요없으므로 캘린더 중심으로만 수집합니다.
    scraped = {
      cleanHtmlStructure: "",
      rawHtmlText: "",
      productGalleryUrls: [],
      heroImageUrl: "",
      sourceProductTitle: tab.title ?? "",
      seoHashtags: [],
      itineraryBlocks: [],
      itineraryExtractMeta: null,
      packageCatalog: null,
      product_source_url: url,
      productCodes: { ...urlCodes },
      _debug: {
        cleanHtmlStructureLength: 0,
        rawHtmlTextLength: 0,
        itineraryBlockCount: 0,
        itineraryDayCount: 0,
      },
    };
    await onProgress?.(12, "부모탭 캘린더 수집 중…");
  }

  const itineraryBlocks = Array.isArray(scraped.itineraryBlocks) ? scraped.itineraryBlocks : [];
  const itineraryDayCount =
    scraped._debug?.itineraryDayCount ??
    new Set(itineraryBlocks.map((block) => block?.day).filter((day) => typeof day === "number" && day > 0)).size;

  console.log("[Scrape] cleanHtmlStructure Length:", scraped.cleanHtmlStructure?.length ?? 0);
  console.log("[Scrape] rawHtmlText Length:", scraped.rawHtmlText?.length ?? 0);
  console.log("[Scrape] itineraryBlocks:", itineraryBlocks.length, "days:", itineraryDayCount);
  if (itineraryBlocks.length === 0 && scraped.itineraryExtractMeta) {
    // 일정 블록이 0건이면 왜 그런지(탭/아코디언을 못 찾았는지, 찾았는데 패널에서
    // 파싱이 안 됐는지) 바로 알 수 있게 상세 진단을 남긴다.
    console.warn("[Scrape] itineraryExtractMeta (0블록 원인 진단):", scraped.itineraryExtractMeta);
  } else if (scraped.itineraryExtractMeta) {
    console.log("[Scrape] itineraryExtractMeta:", scraped.itineraryExtractMeta);
  }

  const pageCodes = scraped.productCodes ?? {};
  const siblingRprs = calendarOnly ? null : await findRprsFromSiblingTabs(tab);
  const meta = {
    saleProdCd: urlCodes.saleProdCd || pageCodes.saleProdCd || null,
    rprsProdCd: urlCodes.rprsProdCd || pageCodes.rprsProdCd || siblingRprs || null,
    depDay: urlCodes.depDay || pageCodes.depDay || null,
  };
  if (!meta.rprsProdCd && !meta.saleProdCd) {
    throw new Error("상품 코드를 찾을 수 없습니다. (rprsProdCd / pkgCd)");
  }
  console.log("[Scrape] rprs=", meta.rprsProdCd, "sale=", meta.saleProdCd);

  const metaForCalendar = rprsProdCdsOverride.length
    ? { ...meta, rprsProdCd: rprsProdCdsOverride[0] }
    : meta;
  if (rprsProdCdsOverride.length) {
    // 상세페이지 자체 추출(meta.rprsProdCd)이 GNB/배너 링크를 잘못 잡는 경우가 있어(예:
    // "MAK2330"), 팝업이 부모탭에서 이미 확인한 override 코드가 있으면 캘린더/리포트에는
    // 항상 이 값을 우선 사용한다. 아래 로그는 그 우선순위를 명확히 보여주기 위한 것으로,
    // 위 "[Scrape] rprs=" 로그와 다른 코드가 보이는 건 버그가 아니라 의도된 우선순위다.
    console.log("[Scrape] rprs(부모탭 override 우선 사용)=", metaForCalendar.rprsProdCd);
  }

  await onProgress?.(28, "캘린더 API 호출…");
  let calendar = null;
  if (rprsProdCdsOverride.length) {
    // major-products에서 `rprsProdCds`가 여러 개면, 각각 호출 후 searchCalendar를 병합한다.
    let merged = null;
    let mergedFetchMeta = [];
    for (const code of rprsProdCdsOverride) {
      const cal = await fetchCalendarInTab(calendarTabId, { ...metaForCalendar, rprsProdCd: code, saleProdCd: null });
      merged = self.HanatourCalendarApi?.mergeCalendarPayloads?.(merged, cal) ?? merged ?? cal;
      if (Array.isArray(cal?.fetchMeta)) mergedFetchMeta = mergedFetchMeta.concat(cal.fetchMeta);
      const calMonths = Object.keys(cal?.searchCalendar ?? {}).length;
      const calDayCount = self.HanatourCollectorCore.countSearchCalendarDays(cal?.searchCalendar);
      console.log("[CalendarOverride] code result:", { code, calMonths, calDayCount, source: cal?.source ?? "none" });
    }
    calendar = merged
      ? {
          ...merged,
          fetchMeta: mergedFetchMeta,
          source: rprsProdCdsOverride.length > 1 ? "major_products_tab_multi" : "major_products_tab",
        }
      : null;
    console.log(
      "[CalendarOverride] merged:",
      {
        months: merged ? Object.keys(merged.searchCalendar ?? {}).length : 0,
        dayCount: self.HanatourCollectorCore.countSearchCalendarDays(merged?.searchCalendar) ?? 0,
      },
    );
  } else {
    calendar = await fetchCalendarInTab(calendarTabId, metaForCalendar);
  }

  // API 실패/빈 결과 시 major-products 탭 DOM 폴백.
  // "활성 탭이 major-products인가"가 아니라 "달력을 호출한 탭(calendarTabId)이
  // major-products인가"로 판정한다 — 상세페이지에서 실행 중이어도 왼쪽 부모탭이
  // major-products면 그 탭에서 월/일 순회를 시도해야 한다.
  let dayCount = self.HanatourCollectorCore.countSearchCalendarDays(calendar?.searchCalendar);
  let dataCount = Array.isArray(calendar?.calendarData) ? calendar.calendarData.length : 0;
  const shouldTryDomBrowse =
    (isCalendarPage || calendarTabIsMajorProducts || rprsProdCdsOverride.length > 0) &&
    dayCount === 0 &&
    dataCount === 0;
  if (shouldTryDomBrowse) {
    try {
      console.warn(
        "[CalendarOverride] API empty -> DOM 월 순회(browseHanatourCalendarMonths) 폴백 시도",
        { calendarTabId, calendarTabIsMajorProducts, isCalendarPage },
      );
      const startYearMonth = extractStartYearMonthFromUrl(calendarTabUrl);
      const domResult = await scrapeCalendarFromParentDomInTab(calendarTabId, 12, startYearMonth);
      const domSearchCalendar = domResult?.searchCalendar;
      if (domSearchCalendar && Object.keys(domSearchCalendar).length > 0) {
        calendar = {
          ...calendar,
          searchCalendar: domSearchCalendar,
          calendarData: undefined,
          source: "dom_month_browse",
          fetchMeta: [...(calendar?.fetchMeta ?? []), ...(domResult?.fetchMeta ?? [])],
        };
        dayCount = self.HanatourCollectorCore.countSearchCalendarDays(calendar?.searchCalendar);
        dataCount = 0;
        console.log("[CalendarOverride] DOM 월 순회 결과:", {
          months: Object.keys(domSearchCalendar ?? {}).length,
          dayCount,
          fetchMeta: domResult?.fetchMeta,
        });
        const staleWarnings = (domResult?.fetchMeta ?? []).filter(
          (m) => m?.source === "price_signature_unchanged_after_month_nav",
        );
        if (staleWarnings.length > 0) {
          console.warn(
            `[CalendarOverride] ⚠ ${staleWarnings.length}개월에서 월 이동 후 가격 배지가 갱신되지 않음 — 해당 달 데이터가 이전 달과 중복될 가능성 있음`,
            staleWarnings,
          );
        }
      } else {
        console.warn(
          "[CalendarOverride] DOM 월 순회도 결과 없음 (major-products 페이지 마크업 확인 필요)",
          { fetchMeta: domResult?.fetchMeta },
        );
        // 완전 실패했어도 원인 진단(strip_detection_init/dom_debug 등)은 보고서에 남긴다.
        if (domResult?.fetchMeta?.length) {
          calendar = {
            ...calendar,
            fetchMeta: [...(calendar?.fetchMeta ?? []), ...domResult.fetchMeta],
          };
        }
      }
    } catch (err) {
      console.warn("[CalendarOverride] DOM 월 순회 실패:", err);
    }
  }
  const searchCalendarKeys = Object.keys(calendar?.searchCalendar ?? {}).sort();
  const calendarSource = calendar?.source ?? "none";

  console.log(
    `[Scrape] Calendar Months: ${searchCalendarKeys.length ? searchCalendarKeys.join(", ") : "(none)"}`,
  );
  console.log("[Scrape] Calendar day count:", dayCount, "calendarData:", dataCount, "source:", calendarSource);

  await onProgress?.(48, `캘린더 ${calendarSource} (${dayCount}건)`);

  const payload = {
    importMode: "full",
    product_source_url: scraped.product_source_url || tab.url,
    rawHtmlText: scraped.rawHtmlText || "",
    cleanHtmlStructure: scraped.cleanHtmlStructure || scraped.rawHtmlText || "",
    productGalleryUrls: scraped.productGalleryUrls ?? [],
    heroImageUrl: scraped.heroImageUrl || "",
    sourceProductTitle: scraped.sourceProductTitle || tab.title || "",
    seoHashtags: scraped.seoHashtags ?? [],
    itineraryBlocks,
    packageCatalog: scraped.packageCatalog ?? undefined,
    hanatourCalendarPayload: {
      rprsProdCd: metaForCalendar.rprsProdCd || metaForCalendar.saleProdCd,
      saleProdCd: meta.saleProdCd,
      depDay: meta.depDay,
      searchCalendar: calendar?.searchCalendar,
      calendarData: calendar?.calendarData,
      fetchMeta: calendar?.fetchMeta,
    },
    _debug: {
      cleanHtmlStructureLength: scraped.cleanHtmlStructure?.length ?? 0,
      rawHtmlTextLength: scraped.rawHtmlText?.length ?? 0,
      itineraryBlockCount: itineraryBlocks.length,
      itineraryDayCount,
      itineraryExtractMeta: scraped.itineraryExtractMeta ?? null,
      searchCalendarKeys,
      searchCalendarDayCount: dayCount,
      calendarDataCount: dataCount,
      calendarSource,
      rprsProdCd: metaForCalendar.rprsProdCd,
      saleProdCd: meta.saleProdCd,
      rprsProdCdList: rprsProdCdsOverride.length ? rprsProdCdsOverride : undefined,
    },
  };

  const summary = {
    textLength: payload.cleanHtmlStructure.length,
    imageCount: payload.productGalleryUrls.length,
    calendarMonthCount: searchCalendarKeys.length,
    calendarDayCount: dayCount,
    itineraryBlockCount: itineraryBlocks.length,
    itineraryDayCount,
    calendarSource,
    rprsProdCd: meta.rprsProdCd,
    saleProdCd: meta.saleProdCd,
    searchCalendarKeys,
  };

  // 이후로는 추가 console.log가 없어 여기서 멈춘 것처럼 보일 수 있어, 완료 시점을 명확히
  // 남긴다. 이 로그가 안 보이면(예외로 catch 블록에 걸림) runCollectOnly의 catch에서
  // importState.error가 채워지고 팝업에 "실패" 메시지가 뜬다 — 콘솔에 이 로그도 없고
  // 팝업도 계속 "진행 중…"이면 그건 실제 서비스워커 종료/충돌이니 별도로 알려달라.
  console.log("[Scrape] collectProductData 완료 — payload 반환", {
    textLength: summary.textLength,
    calendarDayCount: summary.calendarDayCount,
    calendarSource: summary.calendarSource,
  });

  return { payload, summary, tab };
}

async function runCollectOnly(tabId, opts) {
  if (importState.running) {
    return snapshotState();
  }

  importState = {
    running: true,
    percent: 5,
    label: "준비 중…",
    result: null,
    error: null,
    tabId,
  };
  broadcastState();

  try {
    const { payload, summary } = await collectProductData(tabId, (percent, label) => setProgress(percent, label), opts);

    importState.running = false;
    importState.percent = 100;
    importState.label = "수집 완료";
    importState.result = {
      ok: true,
      collectOnly: true,
      payload,
      summary,
      debug: payload._debug,
    };
    console.log("[CollectOnly] 완료 — importState.result 저장됨 (팝업을 열면 즉시 다운로드 가능)", summary);
    broadcastState();
    return snapshotState();
  } catch (err) {
    importState.running = false;
    importState.percent = 0;
    importState.error = err instanceof Error ? err.message : String(err);
    importState.label = "실패";
    importState.result = { ok: false, message: importState.error };
    console.error("[CollectOnly] 실패:", err);
    broadcastState();
    return snapshotState();
  }
}

async function runImport(tabId, opts) {
  if (importState.running) {
    return snapshotState();
  }

  importState = {
    running: true,
    percent: 5,
    label: "준비 중…",
    result: null,
    error: null,
    tabId,
  };
  broadcastState();

  try {
    const { payload, summary } = await collectProductData(tabId, (percent, label) => setProgress(percent, label), opts);

    const dayCount = summary.calendarDayCount;
    const dataCount = payload._debug?.calendarDataCount ?? 0;
    const calendarSource = summary.calendarSource;

    if (dayCount === 0 && dataCount === 0) {
      throw new Error(
        `출발일 캘린더를 수집하지 못했습니다 (source=${calendarSource}, rprs=${summary.rprsProdCd || "-"}, sale=${summary.saleProdCd || "-"}).\n` +
          "부모 검색/리스트 탭을 연 채로 상세에 들어왔는지, 페이지를 새로고침한 뒤 다시 시도하세요.",
      );
    }

    await setProgress(62, "서버로 전송 중…");
    const auth = await resolveApiBaseForAuth(await getApiBaseUrl());
    const apiBase = auth.apiBase;
    const { _debug: _omitDebug, ...importBody } = payload;
    const imported = await importExternal(importBody, apiBase);

    if (imported.status === 401) {
      const tried = productionApiBaseCandidates(apiBase);
      throw new Error(
        `관리자 로그인이 필요합니다.\nAPI: ${apiBase}\n같은 Chrome에서 아래 주소에 로그인했는지 확인하세요.\n${apiBase}/theall_manager_only` +
          (tried.length > 1
            ? `\n\n※ www 유무가 다르면 쿠키가 전달되지 않습니다. 관리자 탭 주소와 API Base를 동일하게 맞추세요.\n(시도: ${tried.join(", ")})`
            : ""),
      );
    }
    if (imported.status === 409) {
      importState.running = false;
      importState.percent = 100;
      importState.label = "이미 등록된 URL";
      importState.result = {
        ok: false,
        duplicate: true,
        existingId: imported.data?.existingId ?? null,
        message: imported.data?.message ?? "이미 같은 원본 URL로 생성된 상품이 있습니다.",
      };
      broadcastState();
      return snapshotState();
    }
    if (imported.status < 200 || imported.status >= 300) {
      const serverMsg =
        imported.data?.error ||
        imported.data?.message ||
        `등록 실패 (HTTP ${imported.status})`;
      const details = imported.data?.details ? `\n상세: ${imported.data.details}` : "";
      throw new Error(`${serverMsg}${details}`);
    }

    importState.running = false;
    importState.percent = 100;
    importState.label = "등록 완료";
    const parsed = imported.data?.parsed ?? {};
    console.log(
      `[Import Result] itineraryEventCount: ${parsed.itineraryEventCount ?? 0}, departureScheduleCount: ${parsed.departureScheduleCount ?? 0}`,
    );
    importState.result = {
      ok: true,
      ...imported.data,
      calendarSource,
      dayCount,
      debug: payload._debug,
    };
    broadcastState();
    return snapshotState();
  } catch (err) {
    importState.running = false;
    importState.percent = 0;
    importState.error = err instanceof Error ? err.message : String(err);
    importState.label = "실패";
    importState.result = { ok: false, message: importState.error };
    console.error("[Import] 실패:", err);
    broadcastState();
    return snapshotState();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  migrateApiBaseUrlIfNeeded().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  migrateApiBaseUrlIfNeeded().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_IMPORT_STATE") {
    sendResponse({ ok: true, state: snapshotState() });
    return false;
  }

  if (message?.type === "GET_API_BASE") {
    getApiBaseUrl()
      .then((apiBaseUrl) => sendResponse({ ok: true, apiBaseUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "SET_API_BASE") {
    setApiBaseUrl(message.apiBaseUrl)
      .then((apiBaseUrl) => sendResponse({ ok: true, apiBaseUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "CHECK_ADMIN_AUTH") {
    checkAdminAuth(message.apiBaseUrl)
      .then((info) => sendResponse(info))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "INSPECT_ACTIVE_TAB") {
    inspectActiveTab()
      .then((info) => sendResponse({ ok: true, ...info }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "START_IMPORT") {
    inspectActiveTab()
      .then((info) => {
        if (!info.ok || !info.tab?.id) throw new Error("활성 탭을 찾을 수 없습니다.");
        if (!info.isProductPage) throw new Error("하나투어 상품 상세 페이지에서만 수집할 수 있습니다.");
        return runImport(info.tab.id, {
          calendarTabId: message.calendarTabId ?? null,
          rprsProdCds: message.rprsProdCds ?? null,
        });
      })
      .then((state) => sendResponse({ ok: !state.error, state }))
      .catch((err) => {
        importState.running = false;
        importState.error = err instanceof Error ? err.message : String(err);
        importState.label = "실패";
        broadcastState();
        sendResponse({ ok: false, error: importState.error, state: snapshotState() });
      });
    return true;
  }

  if (message?.type === "START_COLLECT") {
    inspectActiveTab()
      .then((info) => {
        if (!info.ok || !info.tab?.id) throw new Error("활성 탭을 찾을 수 없습니다.");
        if (!info.isProductPage && !info.isCalendarPage) {
          throw new Error("지원하지 않는 페이지입니다. 상세 또는 부모탭 major-products에서만 수집할 수 있습니다.");
        }
        return runCollectOnly(info.tab.id, {
          calendarOnly: Boolean(info.isCalendarPage) && !info.isProductPage,
          calendarTabId: message.calendarTabId ?? null,
          rprsProdCds: message.rprsProdCds ?? null,
        });
      })
      .then((state) => sendResponse({ ok: !state.error, state }))
      .catch((err) => {
        importState.running = false;
        importState.error = err instanceof Error ? err.message : String(err);
        importState.label = "실패";
        broadcastState();
        sendResponse({ ok: false, error: importState.error, state: snapshotState() });
      });
    return true;
  }

  return false;
});
