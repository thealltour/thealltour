"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, FileText, Map, LifeBuoy, PackageSearch, Star } from "lucide-react";

type MobileFloatingMenuProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
};

const menuItems = [
  { href: "/about", label: "회사소개", key: "about", icon: Info },
  { href: "/quote", label: "견적문의", key: "quote", icon: FileText },
  { href: "/reviews", label: "여행후기", key: "reviews", icon: Star },
  { href: "/blog", label: "여행가이드", key: "blog", icon: Map },
  { href: "/support", label: "고객센터", key: "support", icon: LifeBuoy },
  { href: "/products", label: "패키지상품", key: "products", icon: PackageSearch },
] as const;

export default function MobileFloatingMenu({ activeTab }: MobileFloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pendingKey, setPendingKey] = useState<(typeof menuItems)[number]["key"] | null>(null);
  const [pressedKey, setPressedKey] = useState<(typeof menuItems)[number]["key"] | null>(null);
  const pathname = usePathname();

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
    // Route changed: close panel and reset touch feedback states.
    setIsOpen(false);
    setPendingKey(null);
    setPressedKey(null);
  }, [pathname]);

  function triggerHapticFeedback() {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    navigator.vibrate(12);
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed right-[max(12px,calc(env(safe-area-inset-right)+8px))] top-[max(64px,calc(env(safe-area-inset-top)+64px))] z-50 flex flex-col items-end lg:hidden">
      {isOpen ? (
        <div className="mt-2 w-[min(80vw,17rem)] rounded-2xl border border-site-border bg-[#0F172A]/98 p-2 shadow-md shadow-black/40 backdrop-blur-md">
          <ul className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isPathActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isActive = activeTab === item.key || isPathActive;
              const isPending = pendingKey === item.key;
              const isPressed = pressedKey === item.key;
              const isNavigationLocked = pendingKey !== null && pendingKey !== item.key;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={isNavigationLocked}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold leading-tight transition-colors duration-150 ${
                      isActive
                        ? "border border-[rgba(201,162,39,0.65)] bg-gradient-to-r from-[#1B2431] to-[#162133] text-site-primary"
                        : "border border-white/8 bg-transparent text-site-secondary hover:bg-white/4 hover:border-white/20"
                    } ${isNavigationLocked ? "pointer-events-none opacity-50" : ""}`}
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
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          isActive
                            ? "border-[rgba(201,162,39,0.7)] bg-[#162133]"
                            : "border-white/10 bg-[#111C2D]"
                        }`}
                      >
                        <item.icon className="h-4 w-4 text-[#d4af37]" aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
                    </span>
                    {isPending ? (
                      <span className="text-[11px] font-semibold text-[rgba(201,162,39,0.9)]">
                        이동중...
                      </span>
                    ) : isPressed ? (
                      <span className="h-2 w-2 rounded-full bg-[rgba(201,162,39,0.9)]" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
