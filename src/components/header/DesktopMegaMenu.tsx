"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS } from "./headerNav.constants";
import type { HeaderPrimaryNavKey } from "./headerNav.constants";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { DesktopNavItem } from "./DesktopNavItem";
import { cn } from "@/lib/cn";

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap type-nav transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "text-[var(--foreground)] font-semibold",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "text-[var(--text-muted)]",
    "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  );
}

function getIsActive(item: HeaderPrimaryNavItem, pathname: string): boolean {
  const key = item.key as HeaderPrimaryNavKey;
  if (key === "recommended") return pathname === "/";
  if (key === "inquiry") return pathname === "/quote";
  if (key === "region" || key === "theme") return pathname.startsWith("/products");
  return false;
}

export function DesktopMegaMenu({ primaryNav }: { primaryNav: HeaderPrimaryNavItem[] }) {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<HeaderPrimaryNavKey | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const items = primaryNav.filter((p) =>
    HEADER_DESKTOP_PRIMARY_NAV_KEYS.includes(p.key as HeaderPrimaryNavKey),
  );

  const onClose = useCallback(() => setOpenKey(null), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenKey(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav ref={containerRef} className="flex shrink-0 items-center gap-4" aria-label="탐색 메뉴">
      {items.map((item, index) => (
        <DesktopNavItem
          key={item.key}
          item={item}
          positionIndex={index}
          isOpen={openKey === (item.key as HeaderPrimaryNavKey)}
          onOpen={() => setOpenKey(item.key as HeaderPrimaryNavKey)}
          onClose={onClose}
          isActive={getIsActive(item, pathname)}
          getNavLinkClass={getNavLinkClass}
        />
      ))}
    </nav>
  );
}
