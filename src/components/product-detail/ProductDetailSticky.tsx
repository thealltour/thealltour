"use client";

import { useEffect, useRef, useState } from "react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type ProductDetailStickyProps = {
  priceFormatted: string | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
};

export function ProductDetailStickyDesktop({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
}: ProductDetailStickyProps) {
  const { openModal } = useConsultModal();
  return (
    <aside
      className="hidden lg:block sticky top-24 w-full max-w-[280px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)]"
      aria-label="상품 요약"
    >
      <p className="text-sm font-semibold text-[var(--text-muted)]">예상가</p>
      {priceFormatted ? (
        <p className="font-price-strong mt-1 text-xl font-bold text-[var(--primary)]">
          ₩{priceFormatted}~
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-[var(--text-secondary)]">상담 후 안내</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-white transition hover:bg-[var(--primary-hover)]"
        >
          상담 문의하기
        </button>
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "kakao", size: "md", className: "w-full px-4 py-3" }))}
        >
          카톡 상담
        </a>
      </div>
    </aside>
  );
}

export function ProductDetailStickyMobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
}: ProductDetailStickyProps) {
  const { openModal } = useConsultModal();
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      if (delta > 6) {
        setCompact(true);
      } else if (delta < -4) {
        setCompact(false);
      }
      lastScrollYRef.current = currentY;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCompact(false), 240);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const nextHeight = compact ? 44 : 56;
    document.documentElement.setAttribute("data-mobile-cta", "on");
    document.documentElement.style.setProperty("--cta-h", `${nextHeight}px`);
    return () => {
      document.documentElement.removeAttribute("data-mobile-cta");
      document.documentElement.style.setProperty("--cta-h", "0px");
    };
  }, [compact]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--divider)] bg-[var(--glass-surface)] px-3 backdrop-blur transition-all duration-200 md:hidden"
      style={{
        paddingTop: compact ? "8px" : "12px",
        paddingBottom: compact ? "max(8px, env(safe-area-inset-bottom))" : "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      {priceFormatted ? (
        <span className="font-price-strong text-sm font-bold text-[var(--primary)]">
          ₩{priceFormatted}~
        </span>
      ) : null}
      <div className="flex flex-1 gap-2">
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn flex-1 rounded-xl bg-[var(--primary-hover)] px-4 py-3 text-center text-sm font-semibold text-white"
        >
          {compact ? "상담" : "상담 문의"}
        </button>
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({
              variant: "kakao",
              size: "md",
              className: "h-11 min-h-11 shrink-0 px-4 text-sm font-semibold",
            }),
          )}
        >
          카톡
        </a>
      </div>
    </div>
  );
}
