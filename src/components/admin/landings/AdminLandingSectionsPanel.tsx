"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import AdminLandingSectionRow from "@/components/admin/landings/AdminLandingSectionRow";
import { listLandingSectionsClient, updateLandingSectionClient } from "@/components/admin/landings/api/adminLandings.client";
import type { AdminLandingSection } from "@/types/adminLanding";

type AdminLandingSectionsPanelProps = {
  landingId: string;
  initialSections: AdminLandingSection[];
  reloadDetail?: () => Promise<void>;
  /** Publish 검증에서 섹션 관련 이슈가 있을 때 강조 */
  highlightIssue?: boolean;
};

function normalizeSort(items: AdminLandingSection[]): AdminLandingSection[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, idx) => ({ ...item, sortOrder: idx }));
}

export default function AdminLandingSectionsPanel({
  landingId,
  initialSections,
  reloadDetail,
  highlightIssue,
}: AdminLandingSectionsPanelProps) {
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<AdminLandingSection[]>(() => normalizeSort(initialSections));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(normalizeSort(initialSections));
  }, [initialSections]);

  const ordered = useMemo(() => normalizeSort(items), [items]);

  function patchSection(id: string, patch: Partial<AdminLandingSection>) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveSection(id: string, direction: "up" | "down") {
    setItems((prev) => {
      const list = normalizeSort(prev);
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return prev;
      const next = [...list];
      const a = next[idx];
      next[idx] = next[swapIdx];
      next[swapIdx] = a;
      return normalizeSort(next);
    });
  }

  async function handleReload() {
    try {
      const list = await listLandingSectionsClient(landingId);
      setItems(normalizeSort(list));
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "섹션을 다시 불러오지 못했습니다.");
    }
  }

  async function handleSaveSections() {
    setSaving(true);
    try {
      const list = normalizeSort(items);
      for (const item of list) {
        await updateLandingSectionClient(landingId, item.id, {
          title: item.title,
          description: item.description ?? "",
          body: item.body ?? "",
          isEnabled: item.isEnabled,
          sortOrder: item.sortOrder,
        });
      }
      showToast("success", "섹션 구성이 저장되었습니다.");
      if (reloadDetail) {
        await reloadDetail();
      } else {
        await handleReload();
      }
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "섹션 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={`space-y-4 rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] ${
        highlightIssue ? "ring-2 ring-amber-400/90" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">섹션 구성</h3>
          <p className="text-xs text-[var(--text-muted)]">
            제목/설명/활성 여부/순서를 수정한 뒤 저장하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            disabled={saving}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
          >
            다시 불러오기
          </button>
          <button
            type="button"
            onClick={handleSaveSections}
            disabled={saving}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] disabled:opacity-50"
          >
            {saving ? "저장 중..." : "섹션 저장"}
          </button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-sm text-[var(--text-muted)]">
          구성된 섹션이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((section, idx) => (
            <AdminLandingSectionRow
              key={section.id}
              section={section}
              index={idx}
              total={ordered.length}
              onChange={patchSection}
              onMoveUp={(id) => moveSection(id, "up")}
              onMoveDown={(id) => moveSection(id, "down")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
