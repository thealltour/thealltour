"use client";

import { useMemo, useState } from "react";
import type { ProductSellingPoints } from "@/types/product";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/icons";
import { cn } from "@/lib/cn";

type SectionKey = keyof ProductSellingPoints;

const SECTIONS: Array<{ key: SectionKey; label: string; icon: IconName }> = [
  { key: "corePoints", label: "핵심포인트", icon: "sparkles" },
  { key: "tourism", label: "관광", icon: "explore" },
  { key: "meals", label: "식사", icon: "utensils" },
  { key: "transport", label: "교통", icon: "flight" },
  { key: "insurance", label: "보험", icon: "included" },
];

function renderBody(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="space-y-2 text-sm leading-7 text-slate-700">
      {lines.map((line, i) => (
        <p key={`${i}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-words">
          {line}
        </p>
      ))}
    </div>
  );
}

export type ProductSellingPointsSectionProps = {
  sellingPoints?: ProductSellingPoints | null;
};

export function ProductSellingPointsSection({ sellingPoints }: ProductSellingPointsSectionProps) {
  const available = useMemo(
    () =>
      SECTIONS.filter((s) => {
        const v = sellingPoints?.[s.key];
        return typeof v === "string" && v.trim().length > 0;
      }),
    [sellingPoints],
  );

  const [activeKey, setActiveKey] = useState<SectionKey | null>(null);

  const resolvedActive = activeKey && available.some((s) => s.key === activeKey)
    ? activeKey
    : available[0]?.key ?? null;

  if (available.length === 0) return null;

  const activeSection = available.find((s) => s.key === resolvedActive);
  const activeBody = activeSection ? sellingPoints?.[activeSection.key]?.trim() : "";

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label="상품 핵심안내"
    >
      <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">상품 핵심안내</h2>
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <nav
          className="flex shrink-0 flex-row gap-2 overflow-x-auto md:w-40 md:flex-col md:gap-1"
          aria-label="핵심안내 카테고리"
        >
          {available.map((section) => {
            const isActive = section.key === resolvedActive;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveKey(section.key)}
                className={cn(
                  "flex min-w-[7.5rem] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                  isActive
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon name={section.icon} size={18} decorative className="shrink-0" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {activeSection && activeBody ? (
            <>
              <h3 className="mb-3 text-base font-semibold text-slate-900">{activeSection.label}</h3>
              {renderBody(activeBody)}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
