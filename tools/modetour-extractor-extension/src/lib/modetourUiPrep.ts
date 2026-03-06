/**
 * 추출 전 UI 준비: 일정 탭 활성화 + 일정 DOM 존재 대기.
 * expandedCount는 토글 클릭 수가 아니라 "day 컨테이너 탐지 개수"로 대체.
 */

const TAB_KEYWORDS = ["일정", "여행일정", "상세일정"];
const TAB_WAIT_MS = 500;
const ACCORDION_MAX_CLICKS = 20;
const ACCORDION_CLICK_INTERVAL_MS = 150;
const ACCORDION_AFTER_MS = 500;
const WAIT_FOR_ILCHA_POLL_MS = 200;
const WAIT_FOR_ILCHA_MAX_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PrepareItineraryUiResult = {
  didClickTab: boolean;
  /** day 컨테이너 탐지 개수 (aria-expanded 토글 수 아님) */
  expandedCount: number;
  debug: {
    tabText?: string;
    expandedButtonCount: number;
    firstDayHeaderTexts: string[];
  };
};

/**
 * document.body.innerText에 "일차" 포함 여부를 폴링. 최대 2초.
 */
async function waitForItineraryDom(): Promise<boolean> {
  const deadline = Date.now() + WAIT_FOR_ILCHA_MAX_MS;
  while (Date.now() < deadline) {
    if (typeof document !== "undefined" && document.body?.innerText?.includes("일차")) {
      return true;
    }
    await sleep(WAIT_FOR_ILCHA_POLL_MS);
  }
  return false;
}

/**
 * Day 컨테이너 후보 개수: "n일차" 텍스트를 가진 헤더/블록 개수.
 */
function countDayContainers(): number {
  if (typeof document === "undefined") return 0;
  const seen = new Set<number>();
  const candidates = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, [class*='day'], [class*='Day']",
  );
  for (const el of candidates) {
    const t = (el as HTMLElement).textContent?.trim() ?? "";
    const m = t.match(/(\d{1,2})일차/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 31) seen.add(n);
    }
  }
  return seen.size;
}

/**
 * "일정" 탭을 찾아 클릭한 뒤, 일정 DOM(일차 텍스트)이 나올 때까지 대기.
 * aria-expanded 토글 클릭은 시도하되, expandedCount는 day 컨테이너 탐지 개수로 반환.
 */
export async function prepareItineraryUi(): Promise<PrepareItineraryUiResult> {
  const debug = { expandedButtonCount: 0, firstDayHeaderTexts: [] as string[] };
  let didClickTab = false;

  if (typeof document === "undefined") {
    return { didClickTab, expandedCount: 0, debug };
  }

  const tabCandidates = document.querySelectorAll(
    '[role="tab"], button, a[href="#"], a[role="button"]',
  );
  for (const el of tabCandidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    if (TAB_KEYWORDS.some((k) => lower.includes(k))) {
      (el as HTMLElement).click();
      didClickTab = true;
      debug.tabText = text.slice(0, 50);
      await sleep(TAB_WAIT_MS);
      break;
    }
  }

  await waitForItineraryDom();

  const collapsedButtons: HTMLElement[] = [];
  document.querySelectorAll('button[aria-expanded="false"], [aria-expanded="false"] button').forEach((el) => {
    const btn = el as HTMLElement;
    const container = btn.closest("div, li, section");
    const context = container
      ? (container.textContent ?? "").trim()
      : (btn.textContent ?? "").trim() + (btn.parentElement?.textContent ?? "");
    if (/일차/.test(context)) {
      collapsedButtons.push(btn);
    }
  });

  if (collapsedButtons.length === 0) {
    document.querySelectorAll("button, [role='button']").forEach((el) => {
      const btn = el as HTMLElement;
      const ctx = (btn.closest("[class*='day'], [class*='Day'], [class*='accordion']")?.textContent ?? "") + (btn.textContent ?? "");
      if (/일차/.test(ctx) && btn.getAttribute("aria-expanded") === "false") {
        collapsedButtons.push(btn);
      }
    });
  }

  const seen = new WeakSet<HTMLElement>();
  let clicks = 0;
  for (const btn of collapsedButtons) {
    if (clicks >= ACCORDION_MAX_CLICKS) break;
    if (seen.has(btn)) continue;
    seen.add(btn);
    btn.click();
    clicks++;
    debug.expandedButtonCount = clicks;
    await sleep(ACCORDION_CLICK_INTERVAL_MS);
  }

  await sleep(ACCORDION_AFTER_MS);

  const dayHeaderEls = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, [class*='day'], [class*='Day']",
  );
  for (const el of dayHeaderEls) {
    const t = (el as HTMLElement).textContent?.trim() ?? "";
    if (/(\d{1,2})일차/.test(t) && debug.firstDayHeaderTexts.length < 3) {
      debug.firstDayHeaderTexts.push(t.slice(0, 80));
    }
  }

  const expandedCount = countDayContainers();
  return { didClickTab, expandedCount, debug };
}
