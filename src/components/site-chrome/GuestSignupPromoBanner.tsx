"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const DISMISS_STORAGE_KEY = "theall_guest_signup_banner_hide_until";
const DISMISS_MS = 24 * 60 * 60 * 1000;

/** 골프 랜딩 없이 카카오 OAuth 간편가입으로 바로 이동 */
const BANNER_HREF =
  "/api/auth/kakao/start?next=%2Fmypage&landing_slug=home-banner&landing_path=%2F&utm_source=home_banner&utm_medium=promo&utm_campaign=kakao-sync";

type GuestSignupPromoBannerProps = {
  isLoggedIn: boolean;
};

function isDismissedActive(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

/**
 * 메인 홈 · 비로그인 전용 상단 띠배너.
 * SSR에서는 항상 null → useEffect 이후 마운트 (hydration 안전).
 * CTA는 카카오 간편가입(OAuth start)으로 바로 연결.
 */
export function GuestSignupPromoBanner({ isLoggedIn }: GuestSignupPromoBannerProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome || isLoggedIn) {
      setVisible(false);
      setOpen(false);
      return;
    }
    if (isDismissedActive()) {
      setVisible(false);
      setOpen(false);
      return;
    }
    setVisible(true);
    const id = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, [isHome, isLoggedIn]);

  function handleDismiss(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      // ignore quota / private mode
    }
    setOpen(false);
    window.setTimeout(() => setVisible(false), 220);
  }

  if (!visible) return null;

  return (
    <aside
      className={cn(
        "relative z-[60] w-full overflow-hidden bg-[#1A2B4C] text-white transition-[max-height,opacity] duration-200 ease-out",
        open ? "max-h-12 opacity-100" : "max-h-0 opacity-0",
      )}
      aria-label="신규 가입 혜택 안내"
    >
      <div className="mx-auto flex h-[34px] max-w-[1280px] items-center gap-2 px-3 md:h-[38px] md:px-6">
        <a
          href={BANNER_HREF}
          className="min-w-0 flex-1 truncate text-center text-xs font-medium tracking-tight text-white/95 hover:underline md:text-sm"
        >
          <span className="mr-1.5 inline-block rounded bg-[#FFE812] px-1.5 py-0.5 text-[10px] font-bold text-[#3C1E1E] md:text-[11px]">
            신규 혜택
          </span>
          <span className="md:hidden">신규회원 전용 3만P 즉시 지급 &gt;</span>
          <span className="hidden md:inline">
            지금 카카오 1초 간편가입 시{" "}
            <strong className="font-semibold text-[#FFE812]">30,000P</strong> 즉시 지급!
          </span>
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE812]/50"
          aria-label="24시간 동안 숨기기"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
