export const KAKAO_PIXEL_TRACK_ID = "8445571263787585521";
export const KAKAO_PIXEL_SCRIPT_SRC = "https://t1.daumcdn.net/adfit/static/kp.js";
export const KAKAO_PIXEL_SIGNUP_QUERY = "kakao_signup";
export const KAKAO_PIXEL_SIGNUP_STORAGE_KEY = "kakao_pixel_complete_registration";
export const KAKAO_PIXEL_COMPLETE_PROFILE_PATH = "/auth/complete-profile";

const PRODUCTION_HOSTS = new Set(["thealltour.com", "www.thealltour.com"]);

export function isKakaoPixelEnabled(
  hostname?: string,
  envEnable = process.env.NEXT_PUBLIC_KAKAO_PIXEL_ENABLE,
): boolean {
  if (envEnable === "true") return true;
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).trim();
  return PRODUCTION_HOSTS.has(host);
}

export function shouldTrackKakaoPixelPageView(pathname: string): boolean {
  return !pathname.startsWith("/admin") && !pathname.startsWith("/theall_manager_only");
}

export function shouldFireKakaoPixelCompleteRegistration(pathname: string): boolean {
  return pathname !== KAKAO_PIXEL_COMPLETE_PROFILE_PATH;
}

export function appendKakaoPixelSignupQuery(path: string): string {
  const trimmed = path.trim() || "/";
  const hashIndex = trimmed.indexOf("#");
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : "";
  const qIndex = withoutHash.indexOf("?");
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const search = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
  const params = new URLSearchParams(search);
  params.set(KAKAO_PIXEL_SIGNUP_QUERY, "1");
  return `${pathname}?${params.toString()}${hash}`;
}

export function withKakaoPixelSignupQuery(input: {
  provider: string;
  isNewMember?: boolean;
  destination: string;
}): string {
  if (input.provider !== "kakao" || !input.isNewMember) return input.destination;
  return appendKakaoPixelSignupQuery(input.destination);
}

export function pathHasKakaoPixelSignupQuery(path: string): boolean {
  const withoutHash = path.split("#")[0] ?? path;
  const search = withoutHash.split("?")[1] ?? "";
  return new URLSearchParams(search).get(KAKAO_PIXEL_SIGNUP_QUERY) === "1";
}

export function stripKakaoPixelSignupQueryFromLocation(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(KAKAO_PIXEL_SIGNUP_QUERY) !== "1") return;
  url.searchParams.delete(KAKAO_PIXEL_SIGNUP_QUERY);
  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", nextPath);
}

function getTracker() {
  if (typeof window === "undefined") return null;
  if (typeof window.kakaoPixel !== "function") return null;
  return window.kakaoPixel(KAKAO_PIXEL_TRACK_ID);
}

export function pageView(): void {
  if (!isKakaoPixelEnabled()) return;
  getTracker()?.pageView();
}

export function completeRegistration(): void {
  if (!isKakaoPixelEnabled()) return;
  getTracker()?.completeRegistration();
}

let completeRegistrationSent = false;

export function fireKakaoPixelCompleteRegistrationOnce(): boolean {
  if (completeRegistrationSent) return false;
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem(KAKAO_PIXEL_SIGNUP_STORAGE_KEY) === "1") {
        completeRegistrationSent = true;
        return false;
      }
      sessionStorage.setItem(KAKAO_PIXEL_SIGNUP_STORAGE_KEY, "1");
    } catch {
      // sessionStorage 불가 시 모듈 가드만 사용
    }
  }
  completeRegistrationSent = true;
  completeRegistration();
  return true;
}

/** 테스트에서 모듈 가드를 초기화할 때 사용 */
export function resetKakaoPixelCompleteRegistrationGuard(): void {
  completeRegistrationSent = false;
}
