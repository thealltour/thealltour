/**
 * 하나투어 패키지 상세 — 여행일정 UI 준비 (탭·전체펼침·일차 서브탭·아코디언).
 */
(function (global) {
  // 데이터 완전성 우선: 렌더링/전환 대기 시간을 넉넉히 잡아 1일차 등 첫 패널이
  // 충분히 안정화되기 전에 추출되는 위험을 줄인다(시간이 걸려도 상관없음).
  const MAIN_TAB_WAIT_MS = 1200;
  const DAY_TAB_WAIT_MS = 900;
  const ACCORDION_CLICK_INTERVAL_MS = 250;
  const ACCORDION_MAX_PER_PANEL = 30;
  const EXPAND_ALL_WAIT_MS = 1000;
  const PANEL_STABLE_TIMEOUT_MS = 4000;
  const PANEL_STABLE_POLL_MS = 150;
  const PANEL_STABLE_QUIET_MS = 600;

  // "일차" 뒤에 공백/문자열 끝이 반드시 와야 하던 경계 조건을 제거 —
  // "1일차(9/24목)"처럼 괄호가 바로 붙는 포맷에서도 1일차 탭이 매칭되도록 완화.
  const DAY_TAB_REGEX = /^\s*(\d{1,2})\s*일차/;
  const DAY_ACCORDION_HEADER = /(\d{1,2})일차/;
  const DATE_IN_ACCORDION = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;
  const NAV_HREF_RE = /\/all-search|\/search|keywordcateg=|keyword=/i;
  const SITE_CHROME_SELECTOR =
    "header, footer, nav, [role='banner'], [role='navigation'], [role='search'], [role='contentinfo']";
  const SITE_CHROME_ATTR_RE =
    /gnb|lnb|mega[-_]?menu|global[-_]?nav|all[-_]?menu|top[-_]?nav|site[-_]?header|search[-_]?bar|search[-_]?form|hot[-_]?keyword|hash[-_]?tag|util[-_]?menu/i;
  const GNB_LABEL_RE =
    /^(전체메뉴|베스트|해외여행|항공|호텔|항공\s*\+\s*호텔|투어\/입장권|국내여행|테마여행|제우스|맞춤여행|하나LIVE|하나\s*LIVE|여행기획전|이달의 혜택|로그인|회원가입|고객센터|마이메뉴|예약내역|찜|HOT)$/i;
  const PRODUCT_TAB_RE =
    /여행\s*일정|상세\s*일정|일정\s*표|상품\s*안내|상품\s*설명|상품\s*정보|호텔\s*&\s*관광지|호텔&관광지|선택관광|참고사항/;

  const CALENDAR_CLOSEST_SEL = '[class*="calendar"], [class*="Calendar"]';

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function elementText(el) {
    return (el?.textContent ?? "").trim();
  }

  function resolveAnchorHref(el) {
    if (!el) return "";
    const a = el.tagName?.toLowerCase() === "a" ? el : el.closest?.("a");
    return (a?.getAttribute("href") ?? "").trim();
  }

  function classAndId(el) {
    if (!el) return "";
    const id = el.id || "";
    const cls = typeof el.className === "string" ? el.className : "";
    return `${id} ${cls}`;
  }

  function ownLabel(el, max) {
    if (!el) return "";
    const limit = max ?? 80;
    const aria = (el.getAttribute?.("aria-label") ?? "").trim();
    if (aria) return aria.slice(0, limit);
    let s = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.nodeValue ?? "";
      if (s.length >= limit) break;
    }
    s = s.replace(/\s+/g, " ").trim();
    if (s) return s.slice(0, limit);
    // 호출부(findDaySubTabs 등)는 이미 childElementCount<=12로 스캔 대상을 걸러내므로,
    // 여기서 <=4로 다시 제한하면 아이콘+날짜+라벨처럼 자식이 여러 개인 일차 탭의 라벨을
    // 놓친다(3일차 이후 탭 미인식의 원인). 다만 isSiteChrome의 조상 탐색(제한 없음)에서
    // 거대한 메가메뉴 컨테이너까지 라벨로 읽어버리는 것은 막기 위해 상한을 20으로 완화.
    if ((el.childElementCount ?? 0) <= 20) {
      return elementText(el).slice(0, limit);
    }
    return "";
  }

  function isInsideCalendarWidget(el) {
    if (!el?.closest) return false;
    if (el.closest(CALENDAR_CLOSEST_SEL)) return true;
    const open = global.HanatourCalendarOpen;
    const doc = el.ownerDocument;
    if (!open?.findCalendarWidgetRoot || !doc) return false;
    const root = open.findCalendarWidgetRoot(doc);
    return Boolean(root && root.contains(el));
  }

  function isGalleryNavEl(el) {
    if (!el) return false;
    const cls = typeof el.className === "string" ? el.className : "";
    const aria = (el.getAttribute?.("aria-label") ?? "").toLowerCase();
    return (
      /swiper-button-next|swiper-button-prev/i.test(cls) ||
      /next|이전|다음|slide-next|slide-prev|arrow-right|arrow-left/i.test(cls) ||
      /next|prev|이전|다음/.test(aria)
    );
  }

  function isProductUiClick(el) {
    if (!el) return false;
    if (isInsideCalendarWidget(el) || isGalleryNavEl(el)) return true;
    const text = ownLabel(el, 80).replace(/\s+/g, " ");
    if (PRODUCT_TAB_RE.test(text)) return true;
    if (DAY_TAB_REGEX.test(text) || DAY_ACCORDION_HEADER.test(text)) return true;
    if (/다음\s*일차|이전\s*일차/i.test(text)) return true;
    if (/일정\s*전체\s*펼침|전체\s*펼침/i.test(text)) return true;
    const tablist = el.closest?.('[role="tablist"]');
    if (!tablist) return false;
    let n = 0;
    for (const t of tablist.querySelectorAll('[role="tab"], button')) {
      if (PRODUCT_TAB_RE.test(ownLabel(t, 40))) return true;
      n += 1;
      if (n > 8) break;
    }
    return false;
  }

  function isSiteChrome(el) {
    if (!el?.closest) return false;
    if (isProductUiClick(el) || isInsideCalendarWidget(el)) return false;

    const chrome = el.closest(SITE_CHROME_SELECTOR);
    if (chrome) return true;

    const form = el.closest("form");
    if (form && !isInsideCalendarWidget(form)) {
      const action = `${form.getAttribute("action") ?? ""} ${classAndId(form)}`;
      if (/search|keyword|all-search/i.test(action) && form.closest(SITE_CHROME_SELECTOR)) {
        return true;
      }
    }

    let node = el;
    for (let i = 0; i < 8 && node && node !== el.ownerDocument?.body; i += 1) {
      const idCls = classAndId(node);
      if (SITE_CHROME_ATTR_RE.test(idCls) && !PRODUCT_TAB_RE.test(ownLabel(node, 200))) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function isSearchControl(el) {
    if (!el) return false;
    if (isInsideCalendarWidget(el) || isProductUiClick(el)) return false;
    const type = (el.getAttribute?.("type") ?? el.type ?? "").toLowerCase();
    if (type === "submit" && el.closest(SITE_CHROME_SELECTOR)) return true;
    if (el.closest?.("[role='search']") && !isProductUiClick(el)) return true;
    return false;
  }

  function isInPageHref(href, doc, el) {
    const raw = (href || "").trim();
    if (el && (isInsideCalendarWidget(el) || isProductUiClick(el))) {
      if (!raw || raw === "#" || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) {
        return true;
      }
      if (NAV_HREF_RE.test(raw) && isInsideCalendarWidget(el)) return true;
    }
    if (!raw || raw === "#" || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) {
      if (
        el &&
        (el.getAttribute("role") === "tab" ||
          el.hasAttribute("aria-controls") ||
          el.hasAttribute("aria-expanded")) &&
        !isSiteChrome(el)
      ) {
        return true;
      }
      return false;
    }
    if (NAV_HREF_RE.test(raw)) return false;
    try {
      const base = doc?.defaultView?.location?.href ?? "https://www.hanatour.com/";
      const next = new URL(raw, base);
      const cur = new URL(base);
      if (NAV_HREF_RE.test(next.href)) return false;
      if (next.origin !== cur.origin) return false;
      return next.pathname === cur.pathname;
    } catch {
      return false;
    }
  }

  function isInTopChromeBand(el) {
    if (isProductUiClick(el) || isInsideCalendarWidget(el)) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.top > 96) return false;
    return true;
  }

  function isSafeClickTarget(el) {
    if (!el) return false;
    if (isInsideCalendarWidget(el) || isProductUiClick(el)) return true;
    if (isSiteChrome(el) || isSearchControl(el) || isInTopChromeBand(el)) return false;
    const text = ownLabel(el, 48).replace(/\s+/g, " ");
    const short = text.slice(0, 24).trim();
    if (GNB_LABEL_RE.test(text) || GNB_LABEL_RE.test(short)) return false;
    if (text === "상세보기" || /^상세보기$/.test(text)) return false;
    const href = resolveAnchorHref(el);
    if (href && !isInPageHref(href, el.ownerDocument, el)) return false;
    return true;
  }

  /** 페이지를 떠나지 않는 요소만 click. 헤더·메가메뉴·검색은 건너뛴다. */
  function safeClick(el) {
    if (!isSafeClickTarget(el)) return false;
    el.click();
    return true;
  }

  function isHeaderOrFooter(el) {
    return isSiteChrome(el);
  }

  function findProductContentRoot(doc) {
    if (!doc) return null;
    return doc.querySelector("main") ?? doc.body ?? null;
  }

  /** GNB가 아닌 상품 상세 탭/본문 범위 */
  function findProductTabScope(doc) {
    if (!doc) return null;
    const roots = [doc.querySelector("main"), doc.body].filter(Boolean);
    for (const root of roots) {
      for (const tablist of root.querySelectorAll('[role="tablist"]')) {
        if (isSiteChrome(tablist) && !PRODUCT_TAB_RE.test(elementText(tablist))) continue;
        if (PRODUCT_TAB_RE.test(elementText(tablist))) return tablist;
      }
    }
    for (const root of roots) {
      const candidates = root.querySelectorAll('[role="tab"], button, a, [role="button"]');
      for (const el of candidates) {
        if (isSiteChrome(el) && !isProductUiClick(el)) continue;
        if (PRODUCT_TAB_RE.test(elementText(el).replace(/\s+/g, " "))) {
          return el.closest('[role="tablist"]') ?? el.parentElement ?? root;
        }
      }
    }
    return findProductContentRoot(doc);
  }

  function findItineraryTabPanel(doc) {
    const panels = doc.querySelectorAll('[role="tabpanel"]');
    for (const panel of panels) {
      if (isSiteChrome(panel) && !PRODUCT_TAB_RE.test(elementText(panel).slice(0, 200))) continue;
      if (panel.getAttribute("aria-hidden") === "true") continue;
      const text = elementText(panel);
      if (/일차/.test(text) && text.length > 80) return panel;
    }
    for (const panel of panels) {
      if (isSiteChrome(panel)) continue;
      if (panel.getAttribute("aria-hidden") !== "true" && elementText(panel).length > 80) {
        return panel;
      }
    }
    return findProductContentRoot(doc);
  }

  function clickExpandAllItineraryInScope(scope) {
    if (!scope) return false;
    const groups = [
      scope.querySelectorAll("button, [role='tab'], [role='button']"),
      scope.querySelectorAll("a, span"),
    ];
    for (const candidates of groups) {
      for (const el of candidates) {
        if ((el.childElementCount ?? 0) > 6) continue;
        const text = ownLabel(el, 40);
        if (!/일정\s*전체\s*펼침|전체\s*펼침/i.test(text)) continue;
        if (safeClick(el)) return true;
      }
    }
    return false;
  }

  function findDaySubTabs(doc) {
    const seen = new Set();
    const out = [];
    const scope = findItineraryTabPanel(doc) ?? findProductTabScope(doc);
    if (!scope) return out;
    const candidates = scope.querySelectorAll('[role="tab"], button, a, [role="button"], li');

    for (const el of candidates) {
      if ((el.childElementCount ?? 0) > 12) continue;
      const text = ownLabel(el, 40);
      const m = text.match(DAY_TAB_REGEX);
      if (!m) continue;
      const dayNumber = parseInt(m[1], 10);
      if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) continue;
      if (seen.has(dayNumber)) continue;
      const clickable =
        el.tagName?.toLowerCase() === "button" ||
        el.tagName?.toLowerCase() === "a" ||
        el.getAttribute("role") === "tab" ||
        el.closest('[role="tablist"]') != null;
      if (!clickable && text.length > 12) continue;
      if (!isSafeClickTarget(el)) continue;
      seen.add(dayNumber);
      out.push({ dayNumber, el });
    }

    return out.sort((a, b) => a.dayNumber - b.dayNumber);
  }

  function findAccordionPanelForHeader(headerEl, doc) {
    const controls = headerEl.getAttribute("aria-controls");
    if (controls) {
      const panel = doc.getElementById(controls);
      if (panel && panel !== doc.body) return panel;
    }

    let sibling = headerEl.nextElementSibling;
    if (sibling) {
      const text = elementText(sibling);
      if (text.length > 50) return sibling;
    }

    const parent = headerEl.parentElement;
    if (parent) {
      sibling = parent.nextElementSibling;
      if (sibling && elementText(sibling).length > 50) return sibling;

      for (const child of parent.children) {
        if (child === headerEl || headerEl.contains(child)) continue;
        if (elementText(child).length > 80) return child;
      }
    }

    const container = headerEl.closest("details, li, section, article, div");
    if (container) {
      for (const child of container.querySelectorAll(":scope > div, :scope > section")) {
        if (child === headerEl || headerEl.contains(child)) continue;
        if (elementText(child).length > 80) return child;
      }
    }

    return null;
  }

  function findDayNavButton(doc, direction) {
    const scope = findItineraryTabPanel(doc) ?? findProductTabScope(doc);
    if (!scope) return null;
    const pattern = direction === "next" ? /다음\s*일차/i : /이전\s*일차/i;
    const candidates = scope.querySelectorAll("button, a, [role='button'], span, i");
    for (const el of candidates) {
      const text = elementText(el);
      if (!pattern.test(text)) continue;
      const disabled =
        el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled") ||
        el.classList?.contains("disabled");
      return { el, disabled: !!disabled };
    }
    return null;
  }

  async function collectAllDaySubTabs(doc) {
    const byDay = new Map();
    const maxNavClicks = 20;

    function absorbVisibleTabs() {
      for (const tab of findDaySubTabs(doc)) {
        if (!byDay.has(tab.dayNumber)) byDay.set(tab.dayNumber, tab);
      }
    }

    absorbVisibleTabs();

    for (let i = 0; i < maxNavClicks; i += 1) {
      const nav = findDayNavButton(doc, "next");
      if (!nav || nav.disabled) break;
      const before = byDay.size;
      if (!safeClick(nav.el)) break;
      await sleep(DAY_TAB_WAIT_MS);
      absorbVisibleTabs();
      if (byDay.size === before) break;
    }

    return Array.from(byDay.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }

  function findDayAccordionEntries(doc) {
    const seen = new Set();
    const out = [];
    const scope = findItineraryTabPanel(doc) ?? findProductTabScope(doc);
    if (!scope) return out;
    const scopeIsHuge =
      scope === doc.body || scope === doc.documentElement || scope === doc.querySelector("main");
    const candidates = scope.querySelectorAll(
      scopeIsHuge
        ? "button, [role='button'], summary, h2, h3, h4, [role='tab']"
        : "button, [role='button'], summary, h2, h3, h4, div, span",
    );

    for (const el of candidates) {
      if ((el.childElementCount ?? 0) > 12) continue;
      const text = ownLabel(el, 160);
      if (text.length > 200 || text.length < 4) continue;
      const m = text.match(DAY_ACCORDION_HEADER);
      if (!m) continue;
      // 날짜 패턴이 없어도 헤더 텍스트가 다소 길다는 이유만으로 스킵하지 않도록 완화
      // (1일차 헤더에 부가 안내문이 붙어 길어지는 경우에도 매칭되도록).
      if (!DATE_IN_ACCORDION.test(text) && text.length > 120) continue;

      const dayNumber = parseInt(m[1], 10);
      if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) continue;
      if (seen.has(dayNumber)) continue;

      const panel = findAccordionPanelForHeader(el, doc);
      if (!panel || panel === doc.body) continue;

      seen.add(dayNumber);
      out.push({ dayNumber, headerEl: el, panelEl: panel });
    }

    return out.sort((a, b) => a.dayNumber - b.dayNumber);
  }

  async function activateDayTab(tab, doc) {
    if (!safeClick(tab.el)) return findAccordionPanelForHeader(tab.el, doc);
    await sleep(DAY_TAB_WAIT_MS);

    const selected = doc.querySelector('[role="tab"][aria-selected="true"]');
    if (selected) {
      const panelId = selected.getAttribute("aria-controls");
      if (panelId) {
        const panel = doc.getElementById(panelId);
        if (panel) return panel;
      }
    }

    const tabpanels = doc.querySelectorAll('[role="tabpanel"]');
    for (const panel of tabpanels) {
      const hidden = panel.getAttribute("aria-hidden");
      const style = panel.style?.display;
      if (hidden === "true") continue;
      if (style === "none") continue;
      if (panel.offsetParent !== null || hidden === "false") return panel;
    }

    if (tabpanels.length === 1) return tabpanels[0];

    const container = tab.el.closest("[role='tabpanel'], section, article");
    if (container && container !== doc.body && container.tagName?.toLowerCase() !== "main") {
      for (const s of container.querySelectorAll(":scope > div, :scope > section")) {
        const t = ownLabel(s, 80);
        if (t.includes(`${tab.dayNumber}일차`)) return s;
      }
    }

    return findAccordionPanelForHeader(tab.el, doc);
  }

  async function expandAccordionsIn(root, maxClicks) {
    if (!root) return 0;
    const toggles = [];
    root.querySelectorAll('[aria-expanded="false"]').forEach((el) => toggles.push(el));
    root.querySelectorAll("button, [role='button']").forEach((el) => {
      if (el.getAttribute("aria-expanded") === "false") toggles.push(el);
    });

    const seen = new WeakSet();
    let clicks = 0;
    const limit = maxClicks ?? ACCORDION_MAX_PER_PANEL;

    for (const btn of toggles) {
      if (clicks >= limit) break;
      if (seen.has(btn)) continue;
      seen.add(btn);
      if (!safeClick(btn)) continue;
      clicks += 1;
      await sleep(ACCORDION_CLICK_INTERVAL_MS);
    }
    return clicks;
  }

  function measurePanel(panel) {
    if (!panel) return { textLen: 0, imgCount: 0 };
    const textLen = elementText(panel).length;
    let imgCount = 0;
    panel.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
      if (src && !src.startsWith("data:")) imgCount += 1;
    });
    return { textLen, imgCount };
  }

  async function waitForPanelStable(panel, options) {
    if (!panel) return false;
    const timeout = options?.timeoutMs ?? PANEL_STABLE_TIMEOUT_MS;
    const deadline = Date.now() + timeout;
    let last = measurePanel(panel);
    let lastChange = Date.now();

    while (Date.now() < deadline) {
      await sleep(PANEL_STABLE_POLL_MS);
      const current = measurePanel(panel);
      if (current.textLen !== last.textLen || current.imgCount !== last.imgCount) {
        last = current;
        lastChange = Date.now();
        continue;
      }
      if (Date.now() - lastChange >= PANEL_STABLE_QUIET_MS) return true;
    }
    return false;
  }

  async function scrollPanelToLoadLazy(panel) {
    if (!panel || !panel.scrollHeight) return;
    const win = panel.ownerDocument?.defaultView;
    if (!win) return;
    const step = Math.max(win.innerHeight || 500, 300);
    const maxY = panel.scrollHeight;
    for (let y = 0; y <= maxY; y += step) {
      panel.scrollTop = y;
      await sleep(120);
    }
    panel.scrollTop = 0;
    await sleep(150);
  }

  global.HanatourItineraryUiPrep = {
    MAIN_TAB_WAIT_MS,
    DAY_TAB_WAIT_MS,
    ACCORDION_CLICK_INTERVAL_MS,
    ACCORDION_MAX_PER_PANEL,
    EXPAND_ALL_WAIT_MS,
    PANEL_STABLE_TIMEOUT_MS,
    sleep,
    elementText,
    ownLabel,
    isSafeClickTarget,
    isSiteChrome,
    isInsideCalendarWidget,
    isProductUiClick,
    safeClick,
    findProductTabScope,
    findProductContentRoot,
    findItineraryTabPanel,
    clickExpandAllItineraryInScope,
    findDaySubTabs,
    collectAllDaySubTabs,
    findDayNavButton,
    findDayAccordionEntries,
    findAccordionPanelForHeader,
    activateDayTab,
    expandAccordionsIn,
    waitForPanelStable,
    scrollPanelToLoadLazy,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
