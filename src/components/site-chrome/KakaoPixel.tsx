"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  KAKAO_PIXEL_SIGNUP_QUERY,
  fireKakaoPixelCompleteRegistrationOnce,
  isKakaoPixelEnabled,
  pageView,
  shouldFireKakaoPixelCompleteRegistration,
  shouldTrackKakaoPixelPageView,
  stripKakaoPixelSignupQueryFromLocation,
} from "@/lib/analytics/kakaoPixel";

function KakaoPixelTracker() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const lastPageViewKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isKakaoPixelEnabled()) return;
    if (!shouldTrackKakaoPixelPageView(pathname)) return;

    const key = `${pathname}?${searchParams.toString()}`;
    let cancelled = false;
    let attempts = 0;

    const send = () => {
      if (cancelled) return true;
      if (typeof window.kakaoPixel !== "function") return false;
      if (lastPageViewKey.current === key) return true;
      lastPageViewKey.current = key;
      pageView();
      return true;
    };

    if (send()) return undefined;

    const timer = window.setInterval(() => {
      attempts += 1;
      if (send() || attempts >= 40) window.clearInterval(timer);
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isKakaoPixelEnabled()) return;
    if (searchParams.get(KAKAO_PIXEL_SIGNUP_QUERY) !== "1") return;
    if (!shouldFireKakaoPixelCompleteRegistration(pathname)) return;

    fireKakaoPixelCompleteRegistrationOnce();
    stripKakaoPixelSignupQueryFromLocation();
  }, [pathname, searchParams]);

  return null;
}

export function KakaoPixel() {
  return (
    <Suspense fallback={null}>
      <KakaoPixelTracker />
    </Suspense>
  );
}
