export type FirstTouch = {
  firstLandingUrl: string;
  firstReferrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  firstVisitAt: string;
};

const STORAGE_KEY = "alltour:first_touch";
const LAST_TOUCH_KEY = "alltour:last_touch";

function readTouchFromPage(): FirstTouch {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );

  return {
    firstLandingUrl:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/",
    firstReferrer: typeof document !== "undefined" ? document.referrer || null : null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
    firstVisitAt: new Date().toISOString(),
  };
}

function hasUtmParams(touch: FirstTouch): boolean {
  return Boolean(
    touch.utm_source?.trim() ||
      touch.utm_medium?.trim() ||
      touch.utm_campaign?.trim() ||
      touch.utm_term?.trim() ||
      touch.utm_content?.trim(),
  );
}

export function initFirstTouch() {
  if (typeof window === "undefined") return;

  const touch = readTouchFromPage();

  if (hasUtmParams(touch)) {
    localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(touch));
  }

  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
  }
}

export function getFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirstTouch;
  } catch {
    return null;
  }
}

/** UTM이 포함된 최근 유입(재방문·다른 캠페인 추적용) */
export function getLastTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_TOUCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirstTouch;
  } catch {
    return null;
  }
}

/** 문의 제출 시 first-touch 우선, UTM 재유입 시 last-touch 보조 */
export function getAttributionTouch(): FirstTouch | null {
  return getFirstTouch() ?? getLastTouch();
}
