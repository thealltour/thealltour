"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAppBadgeSync } from "@/hooks/useAdminAppBadge";
import { useAdminPwaUpdateToast } from "@/hooks/useAdminPwaUpdateToast";
import {
  ADMIN_PWA_INSTALL_DISMISS_KEY,
  isAdminPwaStandalone,
  registerAdminServiceWorker,
} from "@/lib/adminPwaClient";
import { isAdminConsolePublicPath } from "@/lib/adminConsolePaths";
import { ADMIN_PWA_HUB_HREF, ADMIN_PWA_HUB_REL } from "@/components/admin/mobile/mobileAdmin.constants";
import { getAdminConsoleRelativePath } from "@/lib/adminConsolePaths";

function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function AdminPwaInstallBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const onHub = getAdminConsoleRelativePath(pathname) === ADMIN_PWA_HUB_REL;

  useEffect(() => {
    if (isAdminPwaStandalone()) return;
    if (localStorage.getItem(ADMIN_PWA_INSTALL_DISMISS_KEY) === "1") return;
    setIsIos(detectIosSafari());
    setVisible(true);
  }, []);

  // 허브 페이지에 설치 안내가 이미 있음
  if (!visible || onHub) return null;

  return (
    <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs text-sky-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">홈 화면에 추가하면 앱처럼 사용할 수 있습니다</p>
          <p className="mt-1 leading-relaxed">
            PC 전용 메뉴에서 추가하면 설치 후 그 화면이 열려 「PC 전용」 안내가 뜰 수 있습니다.{" "}
            <Link href={ADMIN_PWA_HUB_HREF} className="font-semibold underline">
              앱 · 메뉴 허브
            </Link>
            에서 설치해 주세요.
            {isIos ? " (Safari 공유 → 홈 화면에 추가)" : ""}
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

function AdminPwaUpdateToast() {
  const { updateReady, applyUpdate, dismiss } = useAdminPwaUpdateToast();
  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-lg">
        <p className="min-w-0 flex-1 text-[var(--text-primary)]">새 버전이 있습니다. 새로고침할까요?</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-[var(--text-muted)]"
          aria-label="닫기"
        >
          나중에
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

  useEffect(() => {
    if (isAdminConsolePublicPath(pathname)) return;
    if (typeof document === "undefined") return;

    let lastTouchAt = 0;
    const TOUCH_MIN_INTERVAL_MS = 5 * 60 * 1000;

    function sendSessionTouch() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastTouchAt < TOUCH_MIN_INTERVAL_MS) return;
      lastTouchAt = now;
      void fetch("/api/admin/session/touch", { method: "POST" }).catch(() => {
        // heartbeat 실패는 무시
      });
    }

    sendSessionTouch();
    window.addEventListener("focus", sendSessionTouch);
    document.addEventListener("visibilitychange", sendSessionTouch);
    return () => {
      window.removeEventListener("focus", sendSessionTouch);
      document.removeEventListener("visibilitychange", sendSessionTouch);
    };
  }, [pathname]);

  return (
    <>
      {children}
      {!isAdminConsolePublicPath(pathname) ? <AdminPwaUpdateToast /> : null}
    </>
  );
}
