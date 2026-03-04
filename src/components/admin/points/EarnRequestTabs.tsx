"use client";

type Status = "REQUESTED" | "APPROVED" | "REJECTED";

type Props = {
  value: Status;
  onChange: (next: Status) => void;
};

const TABS: Array<{ id: Status; label: string }> = [
  { id: "REQUESTED", label: "REQUESTED" },
  { id: "APPROVED", label: "APPROVED" },
  { id: "REJECTED", label: "REJECTED" },
];

export default function EarnRequestTabs({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              active
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
