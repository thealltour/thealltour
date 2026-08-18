importScripts("hanatourCalendarApi.js");

const PRODUCTION_API_BASE = "https://thealltour.com";
const LOCAL_API_BASE = "http://localhost:3000";

function normalizeApiBaseUrl(url) {
  return url.trim().replace(/\/$/, "");
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
    const self = await chrome.management.getSelf();
    return self.installType === "development";
  } catch {
    return false;
  }
}

async function resolveDefaultApiBaseUrl() {
  if (await isDevelopmentInstall()) {
    return LOCAL_API_BASE;
  }
  return PRODUCTION_API_BASE;
}

/** 운영 ZIP 설치 시 chrome.storage에 남은 localhost 등 잘못된 apiBaseUrl 자동 교정 */
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

  return normalized;
}

async function getApiBaseUrl() {
  return migrateApiBaseUrlIfNeeded();
}

async function onExtensionReady() {
  await migrateApiBaseUrlIfNeeded();
}

chrome.runtime.onInstalled.addListener(() => {
  void onExtensionReady();
});

chrome.runtime.onStartup.addListener(() => {
  void onExtensionReady();
});

async function notifyTab(tabId, message) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    if (message.type === "SHOW_ALERT") {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg) => window.alert(msg),
        args: [message.text],
      });
    }
  }
}

async function showProgress(tabId, percent, label) {
  await notifyTab(tabId, { type: "SHOW_PROGRESS", percent, label });
}

async function hideProgress(tabId, delayMs) {
  await notifyTab(tabId, { type: "HIDE_PROGRESS", delayMs });
}

function startAiProgressTimer(tabId) {
  let percent = 45;
  let tick = 0;
  const labels = [
    "서버로 전송 중…",
    "AI 메타 분석 중…",
    "AI 일정 분석 중…",
    "상품 저장 준비 중…",
  ];
  const timer = setInterval(async () => {
    tick += 1;
    const labelIndex = Math.min(Math.floor(tick / 8), labels.length - 1);
    if (percent < 88) {
      percent += 2;
    } else if (percent < 95) {
      percent += 1;
    }
    await showProgress(tabId, percent, labels[labelIndex]);
  }, 1200);
  return () => clearInterval(timer);
}

function formatDepartureScheduleAlert(departureScheduleCount, scrapePayload) {
  if (departureScheduleCount != null && departureScheduleCount > 0) {
    return `\n출발일: ${departureScheduleCount}건`;
  }
  if (scrapePayload?.hanatourCalendarPayload) {
    return "\n출발일: API 응답은 있으나 파싱 결과 0건";
  }
  return "\n출발일: API 미응답 (상품은 저장됨)";
}

async function importExternal(payload, tabId) {
  const apiBase = await getApiBaseUrl();
  const url = `${apiBase}/api/admin/products/import-external`;

  await showProgress(tabId, 45, "서버로 전송 중…");
  const stopTimer = startAiProgressTimer(tabId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    stopTimer();
    clearTimeout(timeoutId);
    const aborted = err instanceof Error && err.name === "AbortError";
    await showProgress(tabId, 0, aborted ? "시간 초과" : "네트워크 오류");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: aborted
        ? "요청 시간이 초과되었습니다.\nAI 분석에 1~2분 걸릴 수 있습니다. 잠시 후 다시 시도해 주세요."
        : `네트워크 오류: API에 연결할 수 없습니다.\n\n요청 URL:\n${url}\n\n1) Chrome에서 https://thealltour.com/theall_manager_only 에 관리자 로그인\n2) 익스텐션 새로고침(chrome://extensions)\n3) 그래도 실패 시 관리자 > 도구 > 통합 익스텐션에서 ZIP 재설치`,
    });
    return;
  }

  clearTimeout(timeoutId);

  stopTimer();

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    await showProgress(tabId, 0, "로그인 필요");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: `관리자 로그인이 필요합니다.\n동일 Chrome 브라우저에서 아래 주소에 먼저 로그인한 뒤 다시 시도하세요.\n\n${apiBase}/theall_manager_only/login`,
    });
    return;
  }

  if (res.status === 409 && data.existingId) {
    await hideProgress(tabId, 0);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: `이미 등록된 상품입니다.\n기존 ID: ${data.existingId}`,
    });
    return;
  }

  if (!res.ok) {
    await showProgress(tabId, 0, "등록 실패");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: data.message || `등록 실패 (${res.status})`,
    });
    return;
  }

  await showProgress(tabId, 100, "등록 완료");
  await hideProgress(tabId, 1500);

  const title = data.parsed?.title ? `\n제목: ${data.parsed.title}` : "";
  const price = data.parsed?.price != null ? `\n가격: ${Number(data.parsed.price).toLocaleString("ko-KR")}원` : "";
  const gallery =
    data.parsed?.galleryCount != null ? `\n갤러리: ${data.parsed.galleryCount}장` : "";
  const events =
    data.parsed?.itineraryEventCount != null
      ? `\n일정 이벤트: ${data.parsed.itineraryEventCount}개`
      : "";
  const schedules = formatDepartureScheduleAlert(data.parsed?.departureScheduleCount, payload);
  await notifyTab(tabId, {
    type: "SHOW_ALERT",
    text: `상품 등록 완료!${title}${price}${gallery}${events}${schedules}\nID: ${data.id}`,
  });
}

const tabRelations = new Map();

function registerTabRelation(childTabId, parentTabId) {
  if (childTabId && parentTabId && childTabId !== parentTabId) {
    tabRelations.set(childTabId, parentTabId);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabRelations.delete(tabId);
  for (const [childId, parentId] of tabRelations.entries()) {
    if (parentId === tabId) {
      tabRelations.delete(childId);
    }
  }
});

async function queryParentCalendar(parentTabId) {
  try {
    return await chrome.tabs.sendMessage(parentTabId, {
      type: "GET_ACTIVE_CALENDAR",
      tabId: parentTabId,
    });
  } catch {
    await ensureContentScripts(parentTabId);
    return chrome.tabs.sendMessage(parentTabId, {
      type: "GET_ACTIVE_CALENDAR",
      tabId: parentTabId,
    });
  }
}

async function extractSearchCalendarFromPageMain(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const MAX_DEPTH = 12;

      function isObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
      }

      function extractCal(json) {
        if (!isObject(json)) return null;
        const fromData = json.data?.searchCalendar;
        if (isObject(fromData) && Object.keys(fromData).length > 0) return fromData;
        const root = json.searchCalendar;
        if (isObject(root) && Object.keys(root).length > 0) return root;
        return null;
      }

      function countDays(cal) {
        if (!isObject(cal)) return 0;
        let n = 0;
        for (const rows of Object.values(cal)) {
          if (Array.isArray(rows)) n += rows.length;
        }
        return n;
      }

      function walk(node, depth, found) {
        if (depth > MAX_DEPTH || node == null) return;
        if (typeof node === "string") {
          try {
            const parsed = JSON.parse(node.trim());
            const cal = extractCal(parsed);
            if (cal) found.push(cal);
          } catch {
            /* ignore */
          }
          return;
        }
        if (!isObject(node) && !Array.isArray(node)) return;
        const direct = extractCal(node);
        if (direct) found.push(direct);
        const children = Array.isArray(node) ? node.slice(0, 60) : Object.values(node).slice(0, 50);
        for (const child of children) walk(child, depth + 1, found);
      }

      const merged = {};
      function mergeCal(target, source) {
        if (!isObject(source)) return;
        for (const [key, rows] of Object.entries(source)) {
          if (Array.isArray(rows) && rows.length > 0) target[key] = rows;
        }
      }

      const nuxt = window.__NUXT__;
      const roots = [
        window.__INITIAL_STATE__,
        nuxt,
        nuxt?.state,
        nuxt?.data,
        nuxt?.payload,
        window.__NEXT_DATA__,
        window.__PRELOADED_STATE__,
      ];
      try {
        const app = window.useNuxtApp?.();
        if (app?.payload) roots.push(app.payload);
        if (app?.$pinia?.state?.value) roots.push(app.$pinia.state.value);
      } catch {
        /* ignore */
      }

      for (const root of roots) {
        if (!root) continue;
        const found = [];
        walk(root, 0, found);
        for (const cal of found) mergeCal(merged, cal);
      }

      for (const script of document.querySelectorAll("script")) {
        const text = script.textContent || "";
        if (!text.includes("searchCalendar")) continue;
        const idx = text.indexOf('"searchCalendar"');
        if (idx < 0) continue;
        const slice = text.slice(Math.max(0, idx - 200), idx + 12000);
        try {
          const parsed = JSON.parse(`{${slice}`);
          const cal = extractCal(parsed);
          if (cal) mergeCal(merged, cal);
        } catch {
          /* ignore */
        }
      }

      // 데이터 완전성 우선: 보이는 달로 축소하지 않고 수집된 전체 searchCalendar를 반환한다.
      return countDays(merged) > 0 ? merged : null;
    },
  });
  return injection?.result ?? null;
}

async function browseParentCalendar(tabId, maxMonths) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "BROWSE_CALENDAR_MONTHS",
      maxMonths,
      tabId,
    });
  } catch {
    await ensureContentScripts(tabId);
    return chrome.tabs.sendMessage(tabId, {
      type: "BROWSE_CALENDAR_MONTHS",
      maxMonths,
      tabId,
    });
  }
}

async function clickDateStripNextInMainWorld(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      function elementText(el) {
        return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      }

      function findMonthHeader() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
          const text = elementText(node);
          if (text.length > 40) continue;
          if (/\d{4}\s*년\s*\d{1,2}\s*월/.test(text)) return node;
        }
        return null;
      }

      function countDayCells(root) {
        if (!root) return 0;
        let n = 0;
        for (const cell of root.querySelectorAll("li, button, a, td, [class*='day']")) {
          const t = elementText(cell);
          if (/^\d{1,2}$/.test(t) || /\d{1,2}/.test(t)) n += 1;
        }
        return n;
      }

      function hasDayStrip(root) {
        if (!root) return false;
        if (!/[월화수목금토일]/.test(root.textContent ?? "")) return false;
        return countDayCells(root) >= 5;
      }

      function findInnerStrip(header) {
        if (!header) return null;
        const row = header.parentElement;
        let sib = row?.nextElementSibling;
        if (sib && hasDayStrip(sib)) return sib;
        const parent = row?.parentElement;
        if (parent) {
          const kids = [...parent.children];
          const idx = kids.indexOf(row);
          for (let i = idx + 1; i < kids.length; i += 1) {
            if (hasDayStrip(kids[i])) return kids[i];
          }
        }
        return sib;
      }

      function findStripRow(header) {
        if (!header) return null;
        const headerRow = header.parentElement;
        const innerStrip = findInnerStrip(header);
        const nextSibling = headerRow?.nextElementSibling;

        if (nextSibling) {
          if (hasDayStrip(nextSibling) || countDayCells(nextSibling) >= 5) return nextSibling;
          if (innerStrip && nextSibling.contains(innerStrip)) return nextSibling;
        }

        const parent = headerRow?.parentElement;
        if (parent) {
          const kids = [...parent.children];
          const idx = kids.indexOf(headerRow);
          for (let i = idx + 1; i < kids.length; i += 1) {
            const kid = kids[i];
            if (hasDayStrip(kid) || countDayCells(kid) >= 5) return kid;
            if (innerStrip && kid.contains(innerStrip)) return kid;
          }
        }

        if (innerStrip?.parentElement) {
          const row = innerStrip.parentElement;
          if (row && row !== headerRow && !headerRow?.contains(row)) return row;
        }

        return nextSibling ?? innerStrip?.parentElement ?? innerStrip ?? null;
      }

      function isLikelyDayCell(el) {
        if (!el) return false;
        const text = elementText(el);
        if (/^\d{1,2}$/.test(text)) return true;
        if (/\d{1,2}\s*만|최저가/.test(text)) return true;
        if (el.querySelector(".amt, .price, [class*='price'], [class*='amt']")) return true;
        const cls = (el.className ?? "").toString().toLowerCase();
        if (/day_box|day_num|calendar-day|date-item|_day\b/.test(cls)) return true;
        return false;
      }

      function findSiblingNav(innerStrip, direction, headerRow) {
        if (!innerStrip?.parentElement) return null;
        const siblings = [...innerStrip.parentElement.children].filter((k) => !headerRow?.contains(k));
        const idx = siblings.indexOf(innerStrip);
        if (idx < 0) return null;
        const candidate = direction === "next" ? siblings[idx + 1] : siblings[idx - 1];
        if (!candidate || isLikelyDayCell(candidate)) return null;
        if (hasDayStrip(candidate) && countDayCells(candidate) >= 5) return null;
        return candidate;
      }

      function findRowDirectNav(stripRow, headerRow, innerStrip) {
        if (!stripRow) return null;
        const kids = [...stripRow.children].filter((k) => !headerRow?.contains(k));
        const nonDay = kids.filter((k) => {
          if (innerStrip && (k === innerStrip || k.contains(innerStrip))) return false;
          if (hasDayStrip(k) && countDayCells(k) >= 5) return false;
          if (isLikelyDayCell(k)) return false;
          return true;
        });
        return nonDay.length ? nonDay[nonDay.length - 1] : null;
      }

      function hasChevronOrIcon(el) {
        const text = (el.textContent ?? "").trim();
        if (/^\d{1,2}$/.test(text)) return false;
        if (
          text.length <= 2 &&
          el.querySelector("svg, [class*='chevron'], [class*='arrow'], [class*='icon']")
        ) {
          return true;
        }
        const style = getComputedStyle(el);
        return Boolean(style?.cursor === "pointer" && !text);
      }

      function isNavLike(el) {
        const text = (el.textContent ?? "").trim();
        const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
        const cls = (el.className ?? "").toString().toLowerCase();
        return (
          /^>$|^›$|^▶$/.test(text) ||
          /next|forward|right|다음|slide-next/.test(aria) ||
          /next|forward|right|arrow-right|swiper-button-next|slide-next/.test(cls) ||
          hasChevronOrIcon(el)
        );
      }

      function isStripNavDisabled(el) {
        if (!el) return true;
        return (
          el.classList?.contains("off") &&
          (el.classList.contains("next") || el.classList.contains("prev"))
        );
      }

      function findHanatourNextLink(stripRow, headerRow, header) {
        const card =
          header?.closest?.('[class*="calendar"], [class*="Calendar"], [class*="search"]') ??
          stripRow?.parentElement ??
          document.body;
        const scopes = [stripRow, stripRow?.parentElement, card].filter(Boolean);
        const seen = new Set();
        const links = [];
        for (const scope of scopes) {
          for (const el of scope.querySelectorAll("a.next")) {
            if (seen.has(el) || headerRow?.contains(el)) continue;
            seen.add(el);
            links.push(el);
          }
        }
        const enabled = links.filter((el) => !isStripNavDisabled(el));
        return enabled[0] ?? links[0] ?? null;
      }

      function findNextButton(stripRow, headerRow, innerStrip) {
        const hanatourNext = findHanatourNextLink(stripRow, headerRow, findMonthHeader());
        if (hanatourNext && !isStripNavDisabled(hanatourNext)) return hanatourNext;

        const sibling = findSiblingNav(innerStrip, "next", headerRow);
        if (sibling) return sibling;

        const rowNav = findRowDirectNav(stripRow, headerRow, innerStrip);
        if (rowNav) return rowNav;

        const nodes = [
          ...(stripRow?.querySelectorAll(
            "button, a, [role='button'], span, i, div, [class*='btn']",
          ) ?? []),
        ].filter((el) => !headerRow?.contains(el) && !isLikelyDayCell(el));

        const nav = nodes.filter(isNavLike);
        if (nav.length) return nav[nav.length - 1];

        const narrow = nodes.filter((el) => el.getBoundingClientRect().width < 72);
        const pool = narrow.length ? narrow : nodes;
        if (!pool.length) return null;
        return pool.reduce((best, el) => {
          if (!best) return el;
          return el.getBoundingClientRect().right > best.getBoundingClientRect().right ? el : best;
        }, null);
      }

      function trySwiperNext(row) {
        const swiperEl = row?.querySelector(".swiper, [class*='swiper'], [class*='Swiper']");
        if (!swiperEl) return false;
        try {
          const swiper = swiperEl.swiper ?? swiperEl.__swiper__;
          if (typeof swiper?.slideNext === "function") {
            swiper.slideNext();
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      }

      const header = findMonthHeader();
      const headerRow = header?.parentElement;
      const stripRow = findStripRow(header);
      const innerStrip = findInnerStrip(header);

      if (trySwiperNext(stripRow)) return { ok: true, via: "swiper" };

      const btn = findNextButton(stripRow, headerRow, innerStrip);
      if (btn && !isStripNavDisabled(btn)) {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        btn.click();
        return { ok: true, via: "a.next" };
      }

      return { ok: false, reason: "no_button" };
    },
  });
  return injection?.result ?? { ok: false, reason: "no_result" };
}

function isHanatourTabUrl(url) {
  return /hanatour\.com/i.test(url ?? "");
}

function isHanatourSearchPageUrl(url) {
  const href = (url ?? "").toLowerCase();
  if (href.includes("/all-search")) return true;
  if (href.includes("allsearchtab=package")) return true;
  if (href.includes("/search")) return true;
  if (href.includes("keywordcateg=")) return true;
  if (/chpc0pkg\d+m\d+/i.test(href) && !href.includes("/trp/pkg/")) return true;
  return false;
}

function isHanatourDetailPageUrl(url) {
  const href = (url ?? "").toLowerCase();
  if (href.includes("/trp/pkg/")) return true;
  try {
    const parsed = new URL(href);
    const params = parsed.searchParams;
    return (
      Boolean(params.get("pkgcd") || params.get("pkgCd")) &&
      Boolean(params.get("depday") || params.get("depDay"))
    );
  } catch {
    return false;
  }
}

function isMessageChannelClosedError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  return /message channel closed|asynchronous response by returning true/i.test(raw);
}

function scrapeFailureUserMessage(err, startUrl, afterUrl) {
  if (afterUrl && startUrl && afterUrl !== startUrl) {
    return "수집 중 페이지가 이동했습니다. 상품 상세에서 다시 눌러 주세요.";
  }
  if (isHanatourSearchPageUrl(afterUrl || startUrl)) {
    return "수집 중 페이지가 이동했습니다. 상품 상세에서 다시 눌러 주세요.";
  }
  if (isMessageChannelClosedError(err)) {
    return "수집 중 페이지가 이동했습니다. 상품 상세에서 다시 눌러 주세요.";
  }
  return err instanceof Error ? err.message : String(err);
}

async function resolveParentTabCandidates(childTabId) {
  const child = await chrome.tabs.get(childTabId);
  const ids = [];
  const mapped = tabRelations.get(childTabId);
  if (mapped) ids.push(mapped);
  if (child.openerTabId > 0) ids.push(child.openerTabId);

  const siblings = await chrome.tabs.query({ windowId: child.windowId });
  const leftTabs = siblings
    .filter(
      (t) =>
        t.id !== childTabId &&
        t.index < child.index &&
        isHanatourSearchPageUrl(t.url),
    )
    .sort((a, b) => b.index - a.index);
  for (const t of leftTabs) ids.push(t.id);

  const unique = [...new Set(ids)];
  const tabs = await Promise.all(
    unique.map(async (id) => {
      try {
        return await chrome.tabs.get(id);
      } catch {
        return null;
      }
    }),
  );
  return tabs
    .filter((t) => t?.id && isHanatourSearchPageUrl(t.url))
    .map((t) => t.id);
}

async function queryParentCalendarFromCandidates(candidateTabIds, meta, browseMonths) {
  const triedTabIds = [];
  let lastReason = null;
  const maxBrowse = Number(browseMonths) > 0 ? Number(browseMonths) : 0;

  for (const tabId of candidateTabIds) {
    triedTabIds.push(tabId);
    try {
      if (maxBrowse > 0) {
        const browseResponse = await browseParentCalendar(tabId, maxBrowse);
        if (browseResponse?.ok && browseResponse?.searchCalendar) {
          return {
            ok: true,
            searchCalendar: browseResponse.searchCalendar,
            dayCount: browseResponse.dayCount,
            parentTabId: tabId,
            triedTabIds,
            source: browseResponse.source ?? "parent_tab_browse",
            fetchMeta: browseResponse.fetchMeta ?? null,
          };
        }
        lastReason = browseResponse?.reason ?? browseResponse?.error ?? lastReason;
      }

      let response = null;
      try {
        response = await queryParentCalendar(tabId);
      } catch {
        /* content script unavailable */
      }

      if (response?.ok && response?.searchCalendar) {
        return {
          ok: true,
          searchCalendar: response.searchCalendar,
          dayCount: response.dayCount,
          parentTabId: tabId,
          triedTabIds,
          source: "parent_tab",
        };
      }

      lastReason = response?.reason ?? lastReason;

      const mainCal = await extractSearchCalendarFromPageMain(tabId);
      if (mainCal && Object.keys(mainCal).length > 0) {
        let dayCount = 0;
        for (const rows of Object.values(mainCal)) {
          if (Array.isArray(rows)) dayCount += rows.length;
        }
        return {
          ok: true,
          searchCalendar: mainCal,
          dayCount,
          parentTabId: tabId,
          triedTabIds,
          source: "parent_tab_main_world",
        };
      }
    } catch {
      /* try next candidate */
    }
  }

  return {
    ok: false,
    error: lastReason ?? "인접 탭에서 출발일을 찾지 못했습니다.",
    triedTabIds,
  };
}

async function ensureContentScripts(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (pong?.ok) return;
  } catch {
    /* not injected yet */
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: ["discoverHanatourCalendarMain.js"],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      "discoverHanatourCalendar.js",
      "hanatourItineraryUiPrep.js",
      "htmlContextExtract.js",
      "itineraryDomExtract.js",
      "packageCatalogExtract.js",
      "extractProductCode.js",
      "hanatourCalendarFilter.js",
      "hanatourCalendarApi.js",
      "openHanatourCalendar.js",
      "fetchHanatourCalendar.js",
      "browseHanatourCalendarMonths.js",
      "hanatourCrossTabCalendar.js",
      "content.js",
    ],
  });
  await new Promise((r) => setTimeout(r, 500));
}

async function scrapeTab(tabId) {
  let startUrl = "";
  try {
    const tab = await chrome.tabs.get(tabId);
    startUrl = tab.url ?? "";
    registerTabRelation(tabId, tab.openerTabId);
  } catch {
    /* ignore */
  }
  await ensureContentScripts(tabId);
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" });
    if (!response?.ok) {
      throw new Error(response?.error ?? "scrape failed");
    }
    return response.payload;
  } catch (err) {
    let afterUrl = startUrl;
    try {
      afterUrl = (await chrome.tabs.get(tabId)).url ?? startUrl;
    } catch {
      /* ignore */
    }
    throw new Error(scrapeFailureUserMessage(err, startUrl, afterUrl));
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (isHanatourTabUrl(tab.url) && isHanatourSearchPageUrl(tab.url) && !isHanatourDetailPageUrl(tab.url)) {
    await notifyTab(tab.id, {
      type: "SHOW_ALERT",
      text: "하나투어 검색 페이지에서는 수집할 수 없습니다. 상품 상세 페이지에서 다시 눌러 주세요.",
    });
    return;
  }

  await showProgress(tab.id, 5, "준비 중…");

  let payload;
  try {
    payload = await scrapeTab(tab.id);
  } catch (err) {
    console.error("[thealltour-import] scrape failed:", err);
    await hideProgress(tab.id, 0);
    const detail = err instanceof Error ? err.message : String(err);
    await notifyTab(tab.id, {
      type: "SHOW_ALERT",
      text: `페이지 수집에 실패했습니다.\n${detail}\n\n하나투어/모두투어 상세 페이지에서 다시 시도하거나 익스텐션을 새로고침해 주세요.`,
    });
    return;
  }

  if (!payload?.cleanHtmlStructure?.trim()) {
    await hideProgress(tab.id, 0);
    await notifyTab(tab.id, { type: "SHOW_ALERT", text: "수집된 HTML 구조가 없습니다." });
    return;
  }

  await showProgress(tab.id, 42, "수집 완료 · 서버 전송 준비…");
  await importExternal(payload, tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const currentTabId = sender.tab?.id;

  if (message?.type === "REGISTER_CHILD" && currentTabId) {
    registerTabRelation(currentTabId, sender.tab?.openerTabId);
    sendResponse({ ok: true, parentTabId: sender.tab?.openerTabId ?? null });
    return true;
  }

  if (message?.type === "REQUEST_PARENT_CALENDAR" && currentTabId) {
    const meta = message.meta ?? null;
    const browseMonths = message.browseMonths ?? 0;
    resolveParentTabCandidates(currentTabId)
      .then((candidateTabIds) => {
        if (candidateTabIds.length === 0) {
          if (meta?.saleProdCd || meta?.rprsProdCd) {
            return HanatourCalendarApi.fetchCalendarViaApi(meta).then((apiPayload) => {
              if (apiPayload?.searchCalendar || apiPayload?.calendarData?.length) {
                return {
                  ok: true,
                  searchCalendar: apiPayload.searchCalendar ?? {},
                  calendarData: apiPayload.calendarData,
                  dayCount: HanatourCalendarApi.countCalendarDays(apiPayload.searchCalendar),
                  parentTabId: null,
                  triedTabIds: [],
                  source: "background_api_no_parent_tab",
                };
              }
              return { ok: false, error: "인접 탭을 찾을 수 없습니다.", triedTabIds: [] };
            });
          }
          return { ok: false, error: "인접 탭을 찾을 수 없습니다.", triedTabIds: [] };
        }
        return queryParentCalendarFromCandidates(candidateTabIds, meta, browseMonths);
      })
      .then((parentResponse) => {
        if (!parentResponse) return;
        sendResponse(parentResponse);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String(err), triedTabIds: [] });
      });
    return true;
  }

  if (message?.type === "CLICK_DATE_STRIP_NEXT") {
    const tabId = message.tabId ?? currentTabId;
    if (!tabId) {
      sendResponse({ ok: false, error: "no tab id" });
      return true;
    }
    clickDateStripNextInMainWorld(tabId)
      .then((result) => sendResponse(result ?? { ok: false }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "FETCH_HANATOUR_CALENDAR" && message.meta) {
    HanatourCalendarApi.fetchCalendarViaApi(message.meta)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === "IMPORT_EXTERNAL" && message.payload) {
    importExternal(message.payload, sender.tab?.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
