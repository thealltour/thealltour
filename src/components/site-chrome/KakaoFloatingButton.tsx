"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";

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

  const isProductDetailPage =
    /^\/products\/[^/]+\/?$/.test(pathname) || /^\/dev\/product-detail\/[^/]+\/?$/.test(pathname);

  if (pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")) {
    return null;
  }

  const bottomClass = isProductDetailPage
    ? "bottom-[max(76px,env(safe-area-inset-bottom))]"
    : "bottom-[max(16px,env(safe-area-inset-bottom))]";

  return (
    <div
      className={`fixed right-[max(16px,env(safe-area-inset-right))] ${bottomClass} z-50 flex items-center gap-3 sm:hidden`}
    >
      {/* 캡슐 형태 카톡 상담 버튼 - 웹 카톡 버튼과 동일한 톤 */}
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
        className={buttonVariants({
          variant: "kakao",
          size: "sm",
          className:
            "h-11 gap-2 rounded-full px-4 text-[13px] shadow-md hover:shadow-md active:scale-95 max-[360px]:px-3",
        })}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span className="max-[360px]:hidden">카톡 상담</span>
        <span className="hidden max-[360px]:inline">카톡</span>
      </a>
    </div>
  );
}
