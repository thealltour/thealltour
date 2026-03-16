"use client";

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

/**
 * PR29: 핵심 정보 요약 바.
 * 모바일 Hero 아래에서 기간/지역/항공/호텔/상태 등 사실 정보를 짧게 스캔할 수 있게 표시합니다.
 * PR22 핵심 여행 요약 카드(매력/특징)와 역할을 구분합니다.
 */
export function ProductQuickInfoBar({
  durationLabel,
  destinationLabel,
  flightLabel,
  hotelLabel,
  statusLabel,
}: ProductQuickInfoBarProps) {
  const items: { icon?: string; text: string }[] = [];
  if (durationLabel?.trim()) items.push({ icon: "📅", text: durationLabel.trim() });
  if (destinationLabel?.trim()) items.push({ icon: "📍", text: destinationLabel.trim() });
  if (flightLabel?.trim()) items.push({ icon: "✈️", text: flightLabel.trim() });
  if (hotelLabel?.trim()) items.push({ icon: "🏨", text: hotelLabel.trim() });
  if (statusLabel?.trim()) items.push({ icon: "✅", text: statusLabel.trim() });

  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-slate-50/80 px-3 py-2.5 md:hidden"
      aria-label="핵심 정보 요약"
    >
      {items.map((item, i) => (
        <span
          key={`${i}-${item.text}`}
          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-gray-100"
        >
          {item.icon && <span aria-hidden>{item.icon}</span>}
          <span>{item.text}</span>
        </span>
      ))}
    </div>
  );
}
