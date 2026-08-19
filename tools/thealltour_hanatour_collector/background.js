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

async function setProgress(percent, label) {
  importState.percent = percent;
  importState.label = label;
  broadcastState();
  if (importState.tabId != null) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: importState.tabId },
        func: paintProgressInPage,
        args: [percent, label],
      });
    } catch {
      /* chrome:// or inject 불가 */
    }
  }
}

function paintProgressInPage(percent, label) {
  const PROGRESS_ID = "thealltour-hanatour-collector-progress";
  const clamped = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  const text = label || "준비 중…";
  let root = document.getElementById(PROGRESS_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PROGRESS_ID;
    root.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:2147483646;width:280px;padding:16px 18px;border-radius:12px;background:rgba(15,23,42,0.94);color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.4;box-shadow:0 12px 40px rgba(0,0,0,0.35);";
    root.innerHTML = `<div id="${PROGRESS_ID}-label" style="font-weight:600;margin-bottom:10px;"></div><div style="height:8px;background:rgba(255,255,255,0.15);border-radius:999px;overflow:hidden;"><div id="${PROGRESS_ID}-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#38bdf8,#6366f1);border-radius:999px;"></div></div><div id="${PROGRESS_ID}-pct" style="margin-top:8px;font-size:12px;color:#cbd5e1;text-align:right;"></div>`;
    (document.body ?? document.documentElement).appendChild(root);
  }
  root.style.display = "block";
  const bar = document.getElementById(`${PROGRESS_ID}-bar`);
  const pct = document.getElementById(`${PROGRESS_ID}-pct`);
  const lbl = document.getElementById(`${PROGRESS_ID}-label`);
  if (bar) bar.style.width = `${clamped}%`;
  if (pct) pct.textContent = `${clamped}%`;
  if (lbl) lbl.textContent = text;
}

function hideProgressInPage() {
  const el = document.getElementById("thealltour-hanatour-collector-progress");
  if (el) el.style.display = "none";
}

async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return { ok: false, reason: "no_tab", tab: null, isProductPage: false };
  }
  const isProductPage = Boolean(self.HanatourCollectorCore?.isHanatourProductPageUrl(tab.url));
  const codes = self.HanatourCollectorCore?.parseProductCodesFromHref(tab.url) ?? {
    saleProdCd: null,
    rprsProdCd: null,
    depDay: null,
  };
  return { ok: true, tab: { id: tab.id, url: tab.url, title: tab.title ?? "" }, isProductPage, codes };
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

async function collectProductData(tabId, onProgress) {
  const tab = await chrome.tabs.get(tabId);
  if (!self.HanatourCollectorCore?.isHanatourProductPageUrl(tab.url ?? "")) {
    throw new Error("하나투어 상품 상세 페이지에서만 수집할 수 있습니다.");
  }

  await onProgress?.(12, "탭·일정 펼치는 중…");
  const scraped = await scrapeTab(tabId);
  if (!scraped?.rawHtmlText?.trim() && !scraped?.cleanHtmlStructure?.trim()) {
    throw new Error("페이지 텍스트를 수집하지 못했습니다.");
  }

  const itineraryBlocks = Array.isArray(scraped.itineraryBlocks) ? scraped.itineraryBlocks : [];
  const itineraryDayCount =
    scraped._debug?.itineraryDayCount ??
    new Set(itineraryBlocks.map((block) => block?.day).filter((day) => typeof day === "number" && day > 0)).size;

  console.log("[Scrape] cleanHtmlStructure Length:", scraped.cleanHtmlStructure?.length ?? 0);
  console.log("[Scrape] rawHtmlText Length:", scraped.rawHtmlText?.length ?? 0);
  console.log("[Scrape] itineraryBlocks:", itineraryBlocks.length, "days:", itineraryDayCount);

  const urlCodes = self.HanatourCollectorCore.parseProductCodesFromHref(tab.url ?? "");
  const pageCodes = scraped.productCodes ?? {};
  const siblingRprs = await findRprsFromSiblingTabs(tab);
  const meta = {
    saleProdCd: urlCodes.saleProdCd || pageCodes.saleProdCd || null,
    rprsProdCd: urlCodes.rprsProdCd || pageCodes.rprsProdCd || siblingRprs || null,
    depDay: urlCodes.depDay || pageCodes.depDay || null,
  };
  if (!meta.rprsProdCd && !meta.saleProdCd) {
    throw new Error("상품 코드를 찾을 수 없습니다. (rprsProdCd / pkgCd)");
  }
  console.log("[Scrape] rprs=", meta.rprsProdCd, "sale=", meta.saleProdCd);

  await onProgress?.(28, "캘린더 API 호출…");
  const calendar = await fetchCalendarInTab(tabId, meta);
  const dayCount = self.HanatourCollectorCore.countSearchCalendarDays(calendar?.searchCalendar);
  const dataCount = Array.isArray(calendar?.calendarData) ? calendar.calendarData.length : 0;
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
      rprsProdCd: meta.rprsProdCd || meta.saleProdCd,
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
      searchCalendarKeys,
      searchCalendarDayCount: dayCount,
      calendarDataCount: dataCount,
      calendarSource,
      rprsProdCd: meta.rprsProdCd,
      saleProdCd: meta.saleProdCd,
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

  return { payload, summary, tab };
}

async function runCollectOnly(tabId) {
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
    const { payload, summary } = await collectProductData(tabId, (percent, label) =>
      setProgress(percent, label),
    );

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
    broadcastState();
    if (importState.tabId != null) {
      chrome.scripting
        .executeScript({ target: { tabId: importState.tabId }, func: hideProgressInPage })
        .catch(() => {});
    }
    return snapshotState();
  } catch (err) {
    importState.running = false;
    importState.percent = 0;
    importState.error = err instanceof Error ? err.message : String(err);
    importState.label = "실패";
    importState.result = { ok: false, message: importState.error };
    broadcastState();
    if (importState.tabId != null) {
      chrome.scripting
        .executeScript({ target: { tabId: importState.tabId }, func: hideProgressInPage })
        .catch(() => {});
    }
    return snapshotState();
  }
}

async function runImport(tabId) {
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
    const { payload, summary } = await collectProductData(tabId, (percent, label) =>
      setProgress(percent, label),
    );

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
    if (importState.tabId != null) {
      chrome.scripting
        .executeScript({ target: { tabId: importState.tabId }, func: hideProgressInPage })
        .catch(() => {});
    }
    return snapshotState();
  } catch (err) {
    importState.running = false;
    importState.percent = 0;
    importState.error = err instanceof Error ? err.message : String(err);
    importState.label = "실패";
    importState.result = { ok: false, message: importState.error };
    broadcastState();
    if (importState.tabId != null) {
      chrome.scripting
        .executeScript({ target: { tabId: importState.tabId }, func: hideProgressInPage })
        .catch(() => {});
    }
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
        return runImport(info.tab.id);
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
        if (!info.isProductPage) throw new Error("하나투어 상품 상세 페이지에서만 수집할 수 있습니다.");
        return runCollectOnly(info.tab.id);
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
