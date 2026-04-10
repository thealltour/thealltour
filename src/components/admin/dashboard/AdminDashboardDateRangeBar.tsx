"use client";

type AdminDashboardDateRangeBarProps = {
  currentRange: string;
  currentFrom: string;
  currentTo: string;
  updateRange: (range: string, from?: string, to?: string) => void;
  disabled?: boolean;
};

const PRESETS = [
  { key: "today", label: "오늘", short: "오늘" },
  { key: "7d", label: "최근 7일", short: "7일" },
  { key: "30d", label: "최근 30일", short: "30일" },
] as const;

export default function AdminDashboardDateRangeBar({
  currentRange,
  currentFrom,
  currentTo,
  updateRange,
  disabled,
}: AdminDashboardDateRangeBarProps) {
  const isCustom = currentRange === "custom";

  function activateCustom() {
    if (!isCustom) {
      const today = new Date().toISOString().slice(0, 10);
      updateRange("custom", currentFrom || today, currentTo || today);
    }
  }

  return (
    <div
      className={`rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/40 px-2 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] md:mb-0 md:inline md:mr-3 md:text-xs">
        기간
      </p>

      <div className="flex flex-col gap-2 md:inline-flex md:flex-row md:flex-wrap md:items-center md:gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map(({ key, label, short }) => {
            const isActive = currentRange === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateRange(key)}
                className={`min-h-10 rounded-md border px-2 py-2 text-center text-xs font-semibold transition-[background-color,border-color,box-shadow] md:min-h-9 md:px-3 md:py-1.5 ${
                  isActive
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:border-[var(--brand)]/40 hover:bg-[var(--card-muted)]"
                }`}
              >
                <span className="md:hidden">{short}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={activateCustom}
            className={`min-h-10 rounded-md border px-2 py-2 text-center text-xs font-semibold transition-[background-color,border-color] md:min-h-9 md:px-3 md:py-1.5 ${
              isCustom
                ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:border-[var(--brand)]/40 hover:bg-[var(--card-muted)]"
            }`}
          >
            <span className="md:hidden">지정</span>
            <span className="hidden md:inline">직접 지정</span>
          </button>
        </div>

        {isCustom ? (
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)]/60 pt-2 md:flex md:flex-wrap md:items-center md:gap-2 md:border-t-0 md:pt-0">
            <label className="col-span-2 text-[10px] font-medium text-[var(--text-muted)] md:sr-only">
              시작·종료일
            </label>
            <input
              type="date"
              value={currentFrom}
              onChange={(event) => updateRange("custom", event.target.value, currentTo || undefined)}
              className="min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--brand)]/50 md:h-9 md:min-h-0 md:w-auto"
            />
            <input
              type="date"
              value={currentTo}
              onChange={(event) => updateRange("custom", currentFrom || undefined, event.target.value)}
              className="min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--brand)]/50 md:h-9 md:min-h-0 md:w-auto"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
