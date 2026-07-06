"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSiteToast } from "@/components/site-chrome/SiteToastProvider";
import { KAKAO_WELCOME_QUERY_KEY } from "@/lib/auth/kakaoSignupWelcome";

export default function WelcomeKakaoPointsToast() {
  const searchParams = useSearchParams();
  const { showToast } = useSiteToast();

  useEffect(() => {
    if (searchParams.get(KAKAO_WELCOME_QUERY_KEY) !== "1") return;

    showToast("success", "카카오 30,000P가 지급되었습니다. 빠른문의 시 사용할 수 있습니다.");

    const url = new URL(window.location.href);
    url.searchParams.delete(KAKAO_WELCOME_QUERY_KEY);
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", nextPath);
  }, [searchParams, showToast]);

  return null;
}
