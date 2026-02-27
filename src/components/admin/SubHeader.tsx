"use client";

import { useEffect, useMemo, useState } from "react";

export const menuMap = {
  dashboard: ["운영 현황", "통계"],
  product: ["상품 등록", "상품 목록"],
  inquiry: ["전체 문의", "미처리 문의"],
  member: ["회원 목록"],
} as const;

export type MainMenuKey = keyof typeof menuMap;

const MAIN_MENU_TITLE: Record<MainMenuKey, string> = {
  dashboard: "대시보드",
  product: "상품 관리",
  inquiry: "문의 관리",
  member: "회원 관리",
};

type SubHeaderProps = {
  activeMenu: MainMenuKey | null;
  onTabChange?: (label: string) => void;
};

export default function SubHeader({ activeMenu, onTabChange }: SubHeaderProps) {
  const items = useMemo(
    () => (activeMenu ? menuMap[activeMenu] ?? [] : []),
    [activeMenu],
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(items[0] ?? null);

  useEffect(() => {
    const initial = items[0] ?? null;
    setActiveLabel(initial);
    if (initial && onTabChange) {
      onTabChange(initial);
    }
  }, [items, onTabChange]);

  if (!activeMenu || items.length === 0) {
    return null;
  }

  const title = MAIN_MENU_TITLE[activeMenu];

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-10">
        {/* 왼쪽: 제목 + 탭 */}
        <div className="flex items-center gap-10">
          <h1 className="text-base font-semibold text-[#0f172a]">{title}</h1>

          <div className="flex items-center gap-6 text-sm">
            {items.map((label) => {
              const isActive = activeLabel === label;
              return (
                <button
                  key={label}
                  onClick={() => {
                    setActiveLabel(label);
                    onTabChange?.(label);
                  }}
                  className={`relative pb-1 transition-colors duration-200 ${
                    isActive
                      ? "font-semibold text-[#1d4ed8] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#1d4ed8]"
                      : "text-[#64748b] hover:text-[#1d4ed8]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 글로벌 액션 */}
        <button
          type="button"
          className="rounded-md bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af]"
        >
          + 상품 추가
        </button>
      </div>
    </div>
  );
}

