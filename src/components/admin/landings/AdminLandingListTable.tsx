"use client";

import { useEffect, useRef } from "react";
import type { AdminLandingListItem } from "@/types/adminLanding";
import { LANDING_STATUS_LABELS, LANDING_TEMPLATE_LABELS } from "@/components/admin/landings/adminLandings.constants";

type AdminLandingListTableProps = {
  items: AdminLandingListItem[];
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (id: string, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  selectionDisabled?: boolean;
  onEdit: (item: AdminLandingListItem) => void;
  onPreview: (item: AdminLandingListItem) => void;
  onPublish?: (item: AdminLandingListItem) => void;
  onUnpublish?: (item: AdminLandingListItem) => void;
  busyId?: string | null;
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

function statusBadgeClass(status: AdminLandingListItem["status"]): string {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "draft") return "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]";
  return "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
}

export default function AdminLandingListTable({
  items,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectionDisabled = false,
  onEdit,
  onPreview,
  onPublish,
  onUnpublish,
  busyId,
}: AdminLandingListTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = items.some((i) => selectedIds.has(i.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <table className="min-w-full divide-y divide-[var(--border)] text-sm">
        <thead className="bg-[var(--surface-muted)] text-left text-xs text-[var(--text-muted)]">
          <tr>
            <th className="w-10 px-3 py-3 font-medium">
              <span className="sr-only">전체 선택</span>
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--border)]"
                checked={allSelected}
                disabled={selectionDisabled || items.length === 0}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label="목록 전체 선택"
              />
            </th>
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
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)]"
                  checked={selectedIds.has(item.id)}
                  disabled={selectionDisabled || busyId === item.id}
                  onChange={(e) => onToggleSelect(item.id, e.target.checked)}
                  aria-label={`${item.title} 선택`}
                />
              </td>
              <td className="px-4 py-3 font-medium">{item.title}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">/{item.slug}</td>
              <td className="px-4 py-3">{formatTemplateType(item.templateType)}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}
                >
                  {LANDING_STATUS_LABELS[item.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{formatUpdatedAt(item.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    disabled={busyId === item.id}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onPreview(item)}
                    disabled={busyId === item.id}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    미리보기
                  </button>
                  {item.status !== "published" && onPublish ? (
                    <button
                      type="button"
                      onClick={() => onPublish(item)}
                      disabled={busyId === item.id}
                      className="rounded-md border border-emerald-600/30 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {busyId === item.id ? "처리 중..." : "Publish"}
                    </button>
                  ) : null}
                  {item.status === "published" && onUnpublish ? (
                    <button
                      type="button"
                      onClick={() => onUnpublish(item)}
                      disabled={busyId === item.id}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/80 disabled:opacity-50"
                    >
                      {busyId === item.id ? "처리 중..." : "Unpublish"}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
