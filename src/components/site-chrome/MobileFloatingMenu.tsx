"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, FileText, Map, LifeBuoy, PackageSearch, Star, LogIn, LogOut } from "lucide-react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { cn } from "@/lib/cn";

type MobileFloatingMenuProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  isLoggedIn?: boolean;
};

const menuItems = [
  { href: "/about", label: "회사소개", key: "about", icon: Info },
  { href: "/quote", label: "견적문의", key: "quote", icon: FileText },
  { href: "/reviews", label: "여행후기", key: "reviews", icon: Star },
  { href: "/blog", label: "여행가이드", key: "blog", icon: Map },
  { href: "/support", label: "고객센터", key: "support", icon: LifeBuoy },
  { href: "/products", label: "패키지상품", key: "products", icon: PackageSearch },
] as const;

const itemBase =
  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold leading-tight transition-colors duration-150";
const itemInactive =
  "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]";
const itemActive =
  "border border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]";
const iconBadgeBase = "flex h-8 w-8 items-center justify-center rounded-full border";
const iconBadgeInactive = "border-[var(--border)] bg-[var(--surface)]";
const iconBadgeActive = "border-[var(--border-strong)] bg-[var(--surface)]";

export default function MobileFloatingMenu({ activeTab, isLoggedIn = false }: MobileFloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pendingKey, setPendingKey] = useState<(typeof menuItems)[number]["key"] | null>(null);
  const [pressedKey, setPressedKey] = useState<(typeof menuItems)[number]["key"] | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useConsultModal();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handleToggle() {
      setIsOpen((prev) => !prev);
      triggerHapticFeedback();
    }
    window.addEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setPendingKey(null);
    setPressedKey(null);
  }, [pathname]);

  function triggerHapticFeedback() {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    navigator.vibrate(12);
  }

  async function handleLogout() {
    triggerHapticFeedback();
    setIsLoggingOut(true);
    try {
      await fetch("/api/members/logout", { method: "POST" });
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleQuoteConsult() {
    triggerHapticFeedback();
    setIsOpen(false);
    setPendingKey(null);
    setPressedKey(null);
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: `${pathname || "/"}#mobile-menu-quote`,
    });
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-auto fixed right-[calc(env(safe-area-inset-right)+12px)] top-[calc(env(safe-area-inset-top)+56px+8px)] z-50 flex flex-col items-end lg:hidden">
      {isOpen ? (
        <div
          className={cn(
            "mt-2 w-[min(80vw,17rem)] rounded-2xl border border-[var(--border)] p-2 backdrop-blur-md",
            "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-modal)]",
          )}
        >
          <ul className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isPathActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isActive = activeTab === item.key || isPathActive;
              const isPending = pendingKey === item.key;
              const isPressed = pressedKey === item.key;
              const isNavigationLocked = pendingKey !== null && pendingKey !== item.key;

              return (
                <li key={item.href}>
                  {item.key === "quote" ? (
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      aria-disabled={isNavigationLocked}
                      className={cn(
                        itemBase,
                        isActive ? itemActive : itemInactive,
                        isNavigationLocked && "pointer-events-none opacity-50",
                      )}
                      onPointerDown={() => setPressedKey(item.key)}
                      onPointerCancel={() => setPressedKey(null)}
                      onPointerUp={() => setPressedKey(null)}
                      onClick={() => {
                        if (pendingKey) return;
                        handleQuoteConsult();
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            iconBadgeBase,
                            isActive ? iconBadgeActive : iconBadgeInactive,
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]",
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <span>{item.label}</span>
                      </span>
                      {isPressed ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                      ) : null}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      aria-disabled={isNavigationLocked}
                      className={cn(
                        itemBase,
                        isActive ? itemActive : itemInactive,
                        isNavigationLocked && "pointer-events-none opacity-50",
                      )}
                      onPointerDown={() => setPressedKey(item.key)}
                      onPointerCancel={() => setPressedKey(null)}
                      onPointerUp={() => setPressedKey(null)}
                      onClick={() => {
                        if (pendingKey) return;
                        triggerHapticFeedback();
                        setPendingKey(item.key);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            iconBadgeBase,
                            isActive ? iconBadgeActive : iconBadgeInactive,
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]",
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <span>{item.label}</span>
                      </span>
                      {isPending ? (
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                          이동중...
                        </span>
                      ) : isPressed ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                      ) : null}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-[var(--divider)] pt-2">
            {isLoggedIn ? (
              <div className="space-y-1.5">
                <Link
                  href="/mypage"
                  aria-label="마이페이지로 이동"
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-transparent px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[var(--foreground)] transition-colors duration-150",
                    "hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  )}
                  onClick={() => triggerHapticFeedback()}
                >
                  마이페이지
                </Link>
                <Link
                  href="/mypage/points"
                  aria-label="포인트 내역으로 이동"
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[var(--foreground)] transition-colors duration-150",
                    "hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  )}
                  onClick={() => triggerHapticFeedback()}
                >
                  포인트 내역
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-transparent px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[var(--foreground)] transition-colors duration-150",
                    "hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-transparent px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[var(--foreground)] transition-colors duration-150",
                  "hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                )}
                onClick={() => triggerHapticFeedback()}
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>로그인</span>
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
