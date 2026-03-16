"use client";

export type ProductHotelCardProps = {
  /** 호텔 이름 또는 대표 숙소 문구 (예: Chiangmai Resort 또는 동급 호텔) */
  hotelName?: string;
  /** 추가 설명 (예: 치앙마이 시내 위치) */
  hotelDescription?: string;
  /** 호텔 등급 (예: 4성급 호텔) */
  hotelGrade?: string;
};

/**
 * PR26: 호텔 안내 카드.
 * 항공 정보 아래에서 숙박 정보를 카드 형태로 표시합니다.
 */
export function ProductHotelCard({
  hotelName,
  hotelDescription,
  hotelGrade,
}: ProductHotelCardProps) {
  const name = hotelName?.trim();
  const desc = hotelDescription?.trim();
  const grade = hotelGrade?.trim();
  const hasAny = name || desc || grade;

  if (!hasAny) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="호텔 안내"
    >
      <h3 className="mb-4 text-sm font-semibold text-slate-800">호텔 안내</h3>
      <div className="space-y-1.5 text-sm text-slate-700">
        {name && (
          <p className="font-semibold text-slate-800">{name}</p>
        )}
        {desc && (
          <p className="flex items-start gap-1.5 text-gray-600">
            <span aria-hidden>📍</span>
            <span>{desc}</span>
          </p>
        )}
        {grade && (
          <p className="flex items-start gap-1.5 text-gray-600">
            <span aria-hidden>🏨</span>
            <span>{grade}</span>
          </p>
        )}
      </div>
    </div>
  );
}
