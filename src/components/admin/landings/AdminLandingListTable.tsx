import type { AdminLandingListItem } from "@/types/adminLanding";
import { LANDING_STATUS_LABELS, LANDING_TEMPLATE_LABELS } from "@/components/admin/landings/adminLandings.constants";

type AdminLandingListTableProps = {
  items: AdminLandingListItem[];
  onEdit: (item: AdminLandingListItem) => void;
  onPreview: (item: AdminLandingListItem) => void;
};

function formatTemplateType(templateType: AdminLandingListItem["templateType"]): string {
  if (templateType in LANDING_TEMPLATE_LABELS) {
    return LANDING_TEMPLATE_LABELS[templateType as keyof typeof LANDING_TEMPLATE_LABELS] ?? String(templateType);
  }
  return String(templateType);
}

function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdminLandingListTable({ items, onEdit, onPreview }: AdminLandingListTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <table className="min-w-full divide-y divide-[var(--border)] text-sm">
        <thead className="bg-[var(--surface-muted)] text-left text-xs text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">랜딩명</th>
            <th className="px-4 py-3 font-medium">slug</th>
            <th className="px-4 py-3 font-medium">템플릿 유형</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">최근 수정일</th>
            <th className="px-4 py-3 font-medium">액션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-medium">{item.title}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">/{item.slug}</td>
              <td className="px-4 py-3">{formatTemplateType(item.templateType)}</td>
              <td className="px-4 py-3">
                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs">
                  {LANDING_STATUS_LABELS[item.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{formatUpdatedAt(item.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)]"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onPreview(item)}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)]"
                  >
                    미리보기
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
