"use client";

import { useEffect, useRef } from "react";
import { KAKAO_SYNC_LANDING_VIEW_COOKIE } from "@/lib/analytics/kakaoSyncLandingHit";
import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
  trackKakaoSyncLandingView,
} from "@/lib/analytics/trackKakaoSyncFunnel";

function hasMiddlewareViewCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${KAKAO_SYNC_LANDING_VIEW_COOKIE}=`));
}

/** Middleware landing_view가 있으면 중복 전송하지 않음 (하이드레이션 전 이탈은 서버가 담당). */
export function KakaoSyncGolfViewTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (hasMiddlewareViewCookie()) return;
    trackKakaoSyncLandingView({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
    });
  }, []);

  return null;
}
