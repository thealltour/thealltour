"use client";

import { Icon } from "@/components/ui/Icon";

export type ProductQuickInfoBarProps = {
  /** 여행 기간 (예: 5일, 3박 5일) */
  durationLabel?: string;
  /** 지역/도시 (예: 치앙마이·치앙라이, 태국) */
  destinationLabel?: string;
  /** 항공 포함 여부 (예: 항공 포함) */
  flightLabel?: string;
  /** 숙박 정보 (예: 4성급 호텔, 동급 호텔) */
  hotelLabel?: string;
  /** 예약/출발 상태 (예: 예약 가능) */
  statusLabel?: string;
};

type BarItem = { kind: "brand"; name: "calendar" | "region" | "flight" | "hotel"; text: string } | { kind: "status"; text: string };

/**
 * PR29: 핵심 정보 요약 바.
 * 모바일 Hero 아래에서 기간/지역/항공/호텔/상태 등 사실 정보를 짧게 스캔할 수 있게 표시합니다.
 */
export function ProductQuickInfoBar({
  durationLabel,
  destinationLabel,
  flightLabel,
  hotelLabel,
  statusLabel,
}: ProductQuickInfoBarProps) {
  const items: BarItem[] = [];
  if (durationLabel?.trim()) items.push({ kind: "brand", name: "calendar", text: durationLabel.trim() });
  if (destinationLabel?.trim()) items.push({ kind: "brand", name: "region", text: destinationLabel.trim() });
  if (flightLabel?.trim()) items.push({ kind: "brand", name: "flight", text: flightLabel.trim() });
  if (hotelLabel?.trim()) items.push({ kind: "brand", name: "hotel", text: hotelLabel.trim() });
  if (statusLabel?.trim()) items.push({ kind: "status", text: statusLabel.trim() });

  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-slate-50/80 px-2.5 py-2 md:hidden"
      aria-label="핵심 정보 요약"
    >
      {items.map((item, i) => (
        <span
          key={`${i}-${item.text}`}
          className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-gray-100"
        >
          {item.kind === "brand" ? (
            <Icon name={item.name} decorative size={16} className="h-4 w-4 shrink-0 text-content-muted" />
          ) : (
            <span className="shrink-0 text-content-muted" aria-hidden>
              ✓
            </span>
          )}
          <span className="min-w-0 whitespace-normal leading-snug">{item.text}</span>
        </span>
      ))}
    </div>
  );
}
