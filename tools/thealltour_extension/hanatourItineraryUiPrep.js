/**
 * 하나투어 패키지 상세 — 여행일정 UI 준비 (탭·전체펼침·일차 서브탭·아코디언).
 */
(function (global) {
  const MAIN_TAB_WAIT_MS = 800;
  const DAY_TAB_WAIT_MS = 600;
  const ACCORDION_CLICK_INTERVAL_MS = 200;
  const ACCORDION_MAX_PER_PANEL = 30;
  const EXPAND_ALL_WAIT_MS = 700;
  const PANEL_STABLE_TIMEOUT_MS = 2500;
  const PANEL_STABLE_POLL_MS = 150;
  const PANEL_STABLE_QUIET_MS = 400;

  const DAY_TAB_REGEX = /^\s*(\d{1,2})\s*일차(?:\s|$)/;
  const DAY_ACCORDION_HEADER = /(\d{1,2})일차/;
  const DATE_IN_ACCORDION = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function elementText(el) {
    return (el?.textContent ?? "").trim();
  }

  function findItineraryTabPanel(doc) {
    const panels = doc.querySelectorAll('[role="tabpanel"]');
    for (const panel of panels) {
      if (panel.getAttribute("aria-hidden") === "true") continue;
      const text = elementText(panel);
      if (/일차/.test(text) && text.length > 80) return panel;
    }
    for (const panel of panels) {
      if (panel.getAttribute("aria-hidden") !== "true" && elementText(panel).length > 80) {
        return panel;
      }
    }
    return doc.querySelector("main") ?? null;
  }

  function clickExpandAllItineraryInScope(scope) {
    if (!scope) return false;
    const candidates = scope.querySelectorAll("button, a, [role='button'], span");
    for (const el of candidates) {
      const text = elementText(el);
      if (/일정\s*전체\s*펼침|전체\s*펼침/i.test(text)) {
        el.click();
        return true;
      }
    }
    return false;
  }

  function findDaySubTabs(doc) {
    const seen = new Set();
    const out = [];
    const scope = findItineraryTabPanel(doc) ?? doc;
    const candidates = scope.querySelectorAll('[role="tab"], button, a, li, span, div');

    for (const el of candidates) {
      const text = elementText(el);
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
    const scope = findItineraryTabPanel(doc) ?? doc;
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
      nav.el.click();
      await sleep(DAY_TAB_WAIT_MS);
      absorbVisibleTabs();
      if (byDay.size === before) break;
    }

    return Array.from(byDay.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }

  function findDayAccordionEntries(doc) {
    const seen = new Set();
    const out = [];
    const scope = findItineraryTabPanel(doc) ?? doc;
    const candidates = scope.querySelectorAll(
      "button, [role='button'], summary, h2, h3, h4, div, span",
    );

    for (const el of candidates) {
      const text = elementText(el);
      if (text.length > 200 || text.length < 4) continue;
      const m = text.match(DAY_ACCORDION_HEADER);
      if (!m) continue;
      if (!DATE_IN_ACCORDION.test(text) && text.length > 60) continue;

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
    tab.el.click();
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

    const container = tab.el.closest("section, article, main, div");
    if (container) {
      for (const s of container.querySelectorAll("div, section")) {
        const t = elementText(s);
        if (t.includes(`${tab.dayNumber}일차`) && t.length > 80) return s;
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
      btn.click();
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
