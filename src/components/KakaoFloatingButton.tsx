"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

type SiteSettingsResponse = {
  kakao_chat_url?: string;
};

export default function KakaoFloatingButton() {
  const pathname = usePathname();
  const [kakaoChatUrl, setKakaoChatUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsResponse | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        const data = result as SiteSettingsResponse;
        if (isMounted && data.kakao_chat_url) {
          setKakaoChatUrl(data.kakao_chat_url);
        }
      } catch {
        // 실패 시에는 기본 URL 사용
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")) {
    return null;
  }

  return (
    <div className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex items-center gap-3 sm:hidden">
      {/* 데스크탑에서만 노출되는 말풍선 */}
      <span className="hidden sm:inline-flex relative rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
        실시간 상담
        <span
          aria-hidden="true"
          className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-black"
        />
      </span>

      {/* 카카오 버튼 */}
      <a
        href={
          kakaoChatUrl ??
          process.env.NEXT_PUBLIC_KAKAO_CHAT_URL ??
          "https://pf.kakao.com"
        }
        target="_blank"
        rel="noreferrer"
        aria-label="카카오톡 상담 열기"
        title="카카오톡 상담"
        className="inline-flex h-[56px] w-[56px] sm:h-[60px] sm:w-[60px] items-center justify-center rounded-full border border-[#d4af37] bg-[#020617] shadow-[0_3px_8px_rgba(0,0,0,0.3)] transition-all duration-200 ease-out hover:-translate-y-1 hover:bg-[#020617]/90 active:scale-95"
      >
        <MessageCircle className="h-6 w-6 text-[#d4af37]" aria-hidden="true" />
      </a>
    </div>
  );
}
