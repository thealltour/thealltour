"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MessageCircle, Phone, FileText, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

type SiteSettingsForConsult = {
  kakao_chat_url?: string;
  main_phone?: string;
};

export type MobileConsultSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

function resolveKakaoHref(fromSettings: string | null): string {
  return (
    fromSettings?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_CHAT_URL?.trim() ||
    "https://pf.kakao.com"
  );
}

/**
 * 모바일 Header「문의하기」용 상담 선택 Bottom Sheet.
 * 실제 존재하는 채널만 노출: 카카오 / 전화(main_phone) / 견적(/quote).
 */
export function MobileConsultSheet({ isOpen, onClose }: MobileConsultSheetProps) {
  const [kakaoFromSettings, setKakaoFromSettings] = useState<string | null>(null);
  const [mainPhone, setMainPhone] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsForConsult | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        const data = result as SiteSettingsForConsult;
        if (!isMounted) return;
        if (data.kakao_chat_url?.trim()) setKakaoFromSettings(data.kakao_chat_url.trim());
        if (data.main_phone?.trim()) setMainPhone(data.main_phone.trim());
      } catch {
        // fallback URL 사용
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const kakaoHref = resolveKakaoHref(kakaoFromSettings);
  const phoneHref = mainPhone ? `tel:${mainPhone.replace(/\s+/g, "")}` : null;

  function trackAction(label: string, href: string) {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        section: "mobile_header",
        label,
        href,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
  }

  const rowClass =
    "flex min-h-[44px] w-full items-start gap-3 rounded-[var(--radius-lg)] px-[var(--space-base)] py-[var(--space-md)] text-left transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

  const content = (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="상담 방법 선택"
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 border-b-0 bg-[var(--surface)] shadow-[var(--shadow-modal)]",
          "rounded-t-[var(--radius-xl)]",
          "safe-bottom",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-[var(--space-base)] py-[var(--space-md)]">
          <h2 className="type-small font-semibold text-[var(--foreground)]">무엇을 도와드릴까요?</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="상담 메뉴 닫기"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <ul className="flex flex-col gap-1 px-[var(--space-sm)] py-[var(--space-sm)] pb-[var(--space-base)]">
          <li>
            <a
              href={kakaoHref}
              target="_blank"
              rel="noreferrer"
              className={rowClass}
              onClick={() => {
                trackAction("카톡 상담", kakaoHref);
                onClose();
              }}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--theall-kakao-bg)] text-[var(--theall-kakao-text)]">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-small font-semibold text-[var(--foreground)]">
                  카카오톡 상담
                </span>
                <span className="mt-0.5 block type-caption text-[var(--text-muted)]">
                  빠르게 채팅으로 문의
                </span>
              </span>
            </a>
          </li>

          {phoneHref ? (
            <li>
              <a
                href={phoneHref}
                className={rowClass}
                onClick={() => {
                  trackAction("전화 상담", phoneHref);
                  onClose();
                }}
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Phone className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block type-small font-semibold text-[var(--foreground)]">
                    전화 상담
                  </span>
                  <span className="mt-0.5 block type-caption text-[var(--text-muted)]">
                    상담원과 전화로 문의 ({mainPhone})
                  </span>
                </span>
              </a>
            </li>
          ) : null}

          <li>
            <Link
              href="/quote"
              className={rowClass}
              onClick={() => {
                trackAction("여행 견적 문의", "/quote");
                onClose();
              }}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-small font-semibold text-[var(--foreground)]">
                  여행 견적 문의
                </span>
                <span className="mt-0.5 block type-caption text-[var(--text-muted)]">
                  원하는 여행 조건으로 문의
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
