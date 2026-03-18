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

export function initFirstTouch() {
  if (typeof window === "undefined") return;

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return;

  const params = new URLSearchParams(window.location.search);

  const data: FirstTouch = {
    firstLandingUrl: window.location.pathname,
    firstReferrer: document.referrer || null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
    firstVisitAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
