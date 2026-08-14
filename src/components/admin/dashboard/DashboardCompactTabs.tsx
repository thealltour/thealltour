"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminCompactShell } from "@/components/admin/mobile/useAdminCompactShell";

const DASHBOARD_TABS = [
  { id: "ops", label: "운영" },
  { id: "metrics", label: "지표" },
  { id: "kakao_sync", label: "카카오싱크" },
] as const;

type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

function resolveTab(raw: string | null): DashboardTabId {
  if (raw === "metrics" || raw === "kakao_sync") return raw;
  return "ops";
}

/** 컴팩트 셸(PWA·태블릿)에서만 보이는 대시보드 탭. 데스크톱은 SubHeader 사용. */
export function DashboardCompactTabs() {
  const { useCompactShell, isReady } = useAdminCompactShell();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = resolveTab(searchParams.get("tab"));

  if (!isReady || !useCompactShell) return null;

  function go(tab: DashboardTabId) {
    const p = new URLSearchParams(searchParams.toString());
    if (tab === "ops") p.delete("tab");
    else p.set("tab", tab);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="대시보드 탭">
      {DASHBOARD_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => go(tab.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              selected
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
