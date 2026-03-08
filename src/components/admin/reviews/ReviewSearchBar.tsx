"use client";

type ReviewSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ReviewSearchBar({ value, onChange }: ReviewSearchBarProps) {
  return (
    <input
      type="search"
      placeholder="리뷰 내용, 상품 ID, 리뷰 ID로 검색"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      aria-label="리뷰 검색"
    />
  );
}
