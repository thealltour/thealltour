"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileFloatingMenuProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
};

const menuItems = [
  { href: "/about", label: "회사소개", key: "about" },
  { href: "/quote", label: "견적문의", key: "quote" },
  { href: "/reviews", label: "여행후기", key: "reviews" },
  { href: "/blog", label: "블로그", key: "blog" },
  { href: "/support", label: "고객센터", key: "support" },
  { href: "/products", label: "패키지상품", key: "products" },
] as const;

export default function MobileFloatingMenu({ activeTab }: MobileFloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed right-[max(12px,env(safe-area-inset-right))] bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col items-end lg:hidden">
      {isOpen ? (
        <div className="mb-2 w-[min(78vw,15rem)] rounded-2xl border border-[var(--line)] bg-white/95 p-2 shadow-2xl backdrop-blur-sm">
          <ul className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.key;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-xl px-3 py-2 text-[clamp(14px,3.5vw,16px)] font-bold leading-tight transition ${
                      isActive
                        ? "border border-[var(--line)] bg-[#eff6ff] text-[var(--brand-strong)]"
                        : "text-[#0f172a] hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
        className="min-h-12 rounded-full bg-[var(--brand)] px-[clamp(14px,4vw,22px)] py-[clamp(9px,2.8vw,12px)] text-[clamp(14px,3.2vw,16px)] font-bold text-white shadow-lg ring-2 ring-white/80 transition hover:bg-[var(--brand-strong)]"
      >
        메뉴
      </button>
    </div>,
    document.body,
  );
}
