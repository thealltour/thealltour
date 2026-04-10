type Summary = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
  recentReportsCount: number;
};

type MobileModerationSummaryProps = {
  summary: Summary;
};

const ITEMS: { key: keyof Summary; label: string }[] = [
  { key: "pendingCount", label: "검토 대기" },
  { key: "highPriorityCount", label: "우선 확인" },
  { key: "flaggedCount", label: "신고됨" },
  { key: "hiddenCount", label: "숨김" },
  { key: "recentReportsCount", label: "최근 신고" },
];

export function MobileModerationSummary({ summary }: MobileModerationSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="리뷰 검토 요약">
      {ITEMS.map(({ key, label }) => (
        <div
          key={key}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-center shadow-sm"
        >
          <p className="text-lg font-semibold tabular-nums text-[var(--primary)]">{summary[key]}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}
