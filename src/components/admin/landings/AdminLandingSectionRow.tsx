import { LANDING_SECTION_TYPE_LABELS } from "@/components/admin/landings/adminLandings.constants";
import type { AdminLandingSection } from "@/types/adminLanding";

type AdminLandingSectionRowProps = {
  section: AdminLandingSection;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<AdminLandingSection>) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
};

export default function AdminLandingSectionRow({
  section,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
}: AdminLandingSectionRowProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {LANDING_SECTION_TYPE_LABELS[section.sectionType] ?? section.sectionType}
          </span>
          <span className="text-xs text-[var(--text-muted)]">순서 {section.sortOrder + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveUp(section.id)}
            disabled={index === 0}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
          >
            위로
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(section.id)}
            disabled={index === total - 1}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
          >
            아래로
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">제목</span>
          <input
            value={section.title}
            onChange={(e) => onChange(section.id, { title: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">설명</span>
          <textarea
            value={section.description ?? ""}
            onChange={(e) => onChange(section.id, { description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">본문</span>
          <textarea
            value={section.body ?? ""}
            onChange={(e) => onChange(section.id, { body: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={section.isEnabled}
            onChange={(e) => onChange(section.id, { isEnabled: e.target.checked })}
          />
          <span className="text-sm text-[var(--text-primary)]">활성화</span>
        </label>
      </div>
    </div>
  );
}
