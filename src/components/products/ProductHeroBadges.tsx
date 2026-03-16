"use client";

export type ProductHeroBadgesProps = {
  /** 배지 라벨 배열 (이미 중복 제거·최대 개수 적용된 값) */
  badges: string[];
};

/**
 * PR34: Hero 직하단 상품 핵심 배지.
 * 1~2단어 수준의 짧은 키워드만 칩 형태로 표시합니다.
 * 핵심 여행 요약 카드와 역할을 구분합니다.
 */
export function ProductHeroBadges({ badges }: ProductHeroBadgesProps) {
  if (!Array.isArray(badges) || badges.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="상품 핵심 배지"
    >
      {badges.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
