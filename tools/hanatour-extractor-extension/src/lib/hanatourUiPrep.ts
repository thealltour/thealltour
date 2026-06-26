/**
 * 하나투어 패키지 상세 — 여행일정 UI 준비 (탭·전체펼침·일차 서브탭·아코디언).
 */

const MAIN_TAB_WAIT_MS = 500;
const DAY_TAB_WAIT_MS = 400;
const ACCORDION_CLICK_INTERVAL_MS = 120;
const ACCORDION_MAX_PER_PANEL = 30;
const EXPAND_ALL_WAIT_MS = 400;

const DAY_TAB_REGEX = /^\s*(\d{1,2})\s*일차\s*$/;
const DAY_ACCORDION_HEADER = /(\d{1,2})일차/;
const DATE_IN_ACCORDION = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;

export type HanatourDaySubTab = {
  dayNumber: number;
  el: HTMLElement;
};

export type HanatourDayAccordionEntry = {
  dayNumber: number;
  headerEl: HTMLElement;
  panelEl: HTMLElement;
};

export type PrepareHanatourItineraryUiResult = {
  didClickTab: boolean;
  expandAllClicked: boolean;
  dayTabsFound: number;
  dayTabsClicked: number;
  accordionsExpanded: number;
  expandedCount: number;
  debug: {
    tabText?: string;
    expandedButtonCount: number;
    firstDayHeaderTexts: string[];
    dayTabLabels: string[];
  };
};

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function elementText(el: Element): string {
  return (el as HTMLElement).textContent?.trim() ?? "";
}

/** 메인 탭 "여행일정" 클릭 (정확 매칭 우선) */
export function clickMainItineraryTab(doc: Document = document): boolean {
  const candidates = doc.querySelectorAll('[role="tab"], button, a[href="#"], a[role="button"], li');
  let fallback: HTMLElement | null = null;

  for (const el of candidates) {
    const text = elementText(el);
    if (!text) continue;
    if (/^여행\s*일정$/i.test(text) || text === "여행일정") {
      (el as HTMLElement).click();
      return true;
    }
    if (!fallback && text.includes("여행일정")) {
      fallback = el as HTMLElement;
    }
  }

  if (fallback) {
    fallback.click();
    return true;
  }

  for (const el of candidates) {
    const text = elementText(el);
    if (text === "일정" || text.endsWith("일정")) {
      (el as HTMLElement).click();
      return true;
    }
  }

  return false;
}

/** "일정 전체펼침" / "전체펼침" 버튼 */
export function clickExpandAllItinerary(doc: Document = document): boolean {
  const candidates = doc.querySelectorAll("button, a, [role='button'], span");
  for (const el of candidates) {
    const text = elementText(el);
    if (/일정\s*전체\s*펼침|전체\s*펼침/i.test(text)) {
      (el as HTMLElement).click();
      return true;
    }
  }
  return false;
}

/** 1일차 ~ N일차 서브탭 수집 */
export function findDaySubTabs(doc: Document = document): HanatourDaySubTab[] {
  const seen = new Set<number>();
  const out: HanatourDaySubTab[] = [];
  const candidates = doc.querySelectorAll(
    '[role="tab"], button, a, li, span, div',
  );

  for (const el of candidates) {
    const text = elementText(el);
    const m = text.match(DAY_TAB_REGEX);
    if (!m) continue;
    const dayNumber = parseInt(m[1], 10);
    if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) continue;
    if (seen.has(dayNumber)) continue;
    const clickable =
      el instanceof HTMLButtonElement ||
      el instanceof HTMLAnchorElement ||
      el.getAttribute("role") === "tab" ||
      el.closest('[role="tablist"]') != null;
    if (!clickable && text.length > 12) continue;
    seen.add(dayNumber);
    out.push({ dayNumber, el: el as HTMLElement });
  }

  return out.sort((a, b) => a.dayNumber - b.dayNumber);
}

/** 일차 탭 클릭 후 활성 패널 탐색 */
export async function activateDayTab(
  tab: HanatourDaySubTab,
  doc: Document = document,
): Promise<HTMLElement | null> {
  tab.el.click();
  await sleep(DAY_TAB_WAIT_MS);

  const selected = doc.querySelector('[role="tab"][aria-selected="true"]');
  if (selected) {
    const panelId = selected.getAttribute("aria-controls");
    if (panelId) {
      const panel = doc.getElementById(panelId);
      if (panel) return panel as HTMLElement;
    }
  }

  const tabpanels = doc.querySelectorAll('[role="tabpanel"]');
  for (const panel of tabpanels) {
    const hidden = panel.getAttribute("aria-hidden");
    const style = (panel as HTMLElement).style?.display;
    if (hidden === "true") continue;
    if (style === "none") continue;
    if ((panel as HTMLElement).offsetParent !== null || hidden === "false") {
      return panel as HTMLElement;
    }
  }

  if (tabpanels.length === 1) return tabpanels[0] as HTMLElement;

  const container = tab.el.closest("section, article, main, div");
  if (container) {
    const siblings = container.querySelectorAll("div, section");
    for (const s of siblings) {
      const t = elementText(s);
      if (t.includes(`${tab.dayNumber}일차`) && t.length > 80) {
        return s as HTMLElement;
      }
    }
  }

  return findAccordionPanelForHeader(tab.el, doc);
}

/** 일차 아코디언 헤더 → 콘텐츠 패널 탐색 */
export function findAccordionPanelForHeader(
  headerEl: Element,
  doc: Document = document,
): HTMLElement | null {
  const controls = headerEl.getAttribute("aria-controls");
  if (controls) {
    const panel = doc.getElementById(controls);
    if (panel && panel !== doc.body) return panel as HTMLElement;
  }

  let sibling = headerEl.nextElementSibling;
  if (sibling) {
    const text = elementText(sibling);
    if (text.length > 50) return sibling as HTMLElement;
  }

  const parent = headerEl.parentElement;
  if (parent) {
    sibling = parent.nextElementSibling;
    if (sibling && elementText(sibling).length > 50) {
      return sibling as HTMLElement;
    }

    for (const child of parent.children) {
      if (child === headerEl || headerEl.contains(child)) continue;
      if (elementText(child).length > 80) return child as HTMLElement;
    }
  }

  const container = headerEl.closest("details, li, section, article, div");
  if (container) {
    for (const child of container.querySelectorAll(":scope > div, :scope > section")) {
      if (child === headerEl || headerEl.contains(child)) continue;
      if (elementText(child).length > 80) return child as HTMLElement;
    }
  }

  return null;
}

/** 전체펼침 후 보이는 일차 아코디언 헤더·패널 수집 */
export function findDayAccordionEntries(doc: Document = document): HanatourDayAccordionEntry[] {
  const seen = new Set<number>();
  const out: HanatourDayAccordionEntry[] = [];
  const candidates = doc.querySelectorAll(
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
    out.push({ dayNumber, headerEl: el as HTMLElement, panelEl: panel });
  }

  return out.sort((a, b) => a.dayNumber - b.dayNumber);
}

/** 패널 내 접힌 아코디언 펼침 */
export async function expandAccordionsIn(
  root: Element,
  maxClicks = ACCORDION_MAX_PER_PANEL,
): Promise<number> {
  const toggles: HTMLElement[] = [];
  root.querySelectorAll('[aria-expanded="false"]').forEach((el) => {
    toggles.push(el as HTMLElement);
  });
  root.querySelectorAll("button, [role='button']").forEach((el) => {
    const btn = el as HTMLElement;
    if (btn.getAttribute("aria-expanded") === "false") toggles.push(btn);
  });

  const seen = new WeakSet<HTMLElement>();
  let clicks = 0;
  for (const btn of toggles) {
    if (clicks >= maxClicks) break;
    if (seen.has(btn)) continue;
    seen.add(btn);
    btn.click();
    clicks++;
    await sleep(ACCORDION_CLICK_INTERVAL_MS);
  }
  return clicks;
}

/**
 * 메인 여행일정 탭 + 전체펼침만 수행 (일차 파싱은 itineraryDomHanatour에서 순회).
 */
export async function prepareHanatourItineraryUi(
  doc: Document = document,
): Promise<PrepareHanatourItineraryUiResult> {
  const debug = {
    expandedButtonCount: 0,
    firstDayHeaderTexts: [] as string[],
    dayTabLabels: [] as string[],
  };

  if (typeof document === "undefined") {
    return {
      didClickTab: false,
      expandAllClicked: false,
      dayTabsFound: 0,
      dayTabsClicked: 0,
      accordionsExpanded: 0,
      expandedCount: 0,
      debug,
    };
  }

  const didClickTab = clickMainItineraryTab(doc);
  if (didClickTab) await sleep(MAIN_TAB_WAIT_MS);

  const expandAllClicked = clickExpandAllItinerary(doc);
  if (expandAllClicked) await sleep(EXPAND_ALL_WAIT_MS);

  const dayTabs = findDaySubTabs(doc);
  debug.dayTabLabels = dayTabs.map((t) => elementText(t.el).slice(0, 40));

  return {
    didClickTab,
    expandAllClicked,
    dayTabsFound: dayTabs.length,
    dayTabsClicked: 0,
    accordionsExpanded: 0,
    expandedCount: dayTabs.length,
    debug,
  };
}

export { findDaySubTabs as getHanatourDaySubTabs };
