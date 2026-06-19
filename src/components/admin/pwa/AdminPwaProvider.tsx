"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAdminAppBadgeSync } from "@/hooks/useAdminAppBadge";
import {
  ADMIN_PWA_INSTALL_DISMISS_KEY,
  isAdminPwaStandalone,
  registerAdminServiceWorker,
} from "@/lib/adminPwaClient";
import { isAdminConsolePublicPath } from "@/lib/adminConsolePaths";

function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function AdminPwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isAdminPwaStandalone()) return;
    if (localStorage.getItem(ADMIN_PWA_INSTALL_DISMISS_KEY) === "1") return;
    setIsIos(detectIosSafari());
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs text-sky-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">홈 화면에 추가하면 앱처럼 사용할 수 있습니다</p>
          <p className="mt-1 leading-relaxed">
            {isIos
              ? "Safari 하단 공유(↑) → 「홈 화면에 추가」 → 추가된 아이콘으로 실행해 주세요."
              : "Chrome 메뉴(⋮) → 「홈 화면에 추가」 또는 「앱 설치」를 선택해 주세요."}
          </p>
        </div>
        <button
          type="button"
          aria-label="닫기"
          className="shrink-0 rounded px-1 text-sky-700"
          onClick={() => {
            localStorage.setItem(ADMIN_PWA_INSTALL_DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** 관리자 PWA: Service Worker 등록 + 설치 안내 + OS 아이콘 배지 동기화 */
export function AdminPwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useAdminAppBadgeSync();

  useEffect(() => {
    if (isAdminConsolePublicPath(pathname)) return;
    void registerAdminServiceWorker();

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "ADMIN_PUSH_RESUBSCRIBE") {
        window.dispatchEvent(new CustomEvent("admin-push-resubscribe"));
      }
    }

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", handleMessage);
  }, [pathname]);

  return <>{children}</>;
}
