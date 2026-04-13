"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import AdminLandingEmptyState from "@/components/admin/landings/AdminLandingEmptyState";
import AdminLandingListTable from "@/components/admin/landings/AdminLandingListTable";
import {
  AdminLandingPublishClientError,
  deleteAdminLandingClient,
  listAdminLandingsClient,
  publishAdminLandingClient,
  unpublishAdminLandingClient,
} from "@/components/admin/landings/api/adminLandings.client";
import {
  ADMIN_LANDINGS_GENERATE_FROM_TAXONOMY_ROUTE,
  ADMIN_LANDINGS_EMPTY_DESCRIPTION,
  ADMIN_LANDINGS_EMPTY_TITLE,
  ADMIN_LANDINGS_ERROR_DESCRIPTION,
  ADMIN_LANDINGS_ERROR_TITLE,
  ADMIN_LANDINGS_FUTURE_NEW_ROUTE,
  ADMIN_LANDINGS_SUMMARY_DEFAULT,
  buildAdminLandingEditHref,
  buildAdminLandingPreviewHref,
} from "@/components/admin/landings/adminLandings.constants";
import type { AdminLandingListItem } from "@/types/adminLanding";

const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function AdminLandingManager() {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const isClient = useIsClient();
  const [items, setItems] = useState<AdminLandingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminLandingsClient();
      setItems(result.items ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : ADMIN_LANDINGS_ERROR_DESCRIPTION;
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const valid = new Set(items.map((i) => i.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [items]);

  const toggleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (selected: boolean) => {
      if (!selected) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(items.map((i) => i.id)));
    },
    [items],
  );

  const summary = useMemo(() => {
    if (items.length === 0) return ADMIN_LANDINGS_SUMMARY_DEFAULT;
    const published = items.filter((item) => item.status === "published").length;
    const archived = items.filter((item) => item.status === "archived").length;
    return {
      total: items.length,
      published,
      archived,
      draft: Math.max(0, items.length - published - archived),
    };
  }, [items]);

  function handleCreateClick() {
    router.push(ADMIN_LANDINGS_FUTURE_NEW_ROUTE);
  }

  function handleGenerateClick() {
    router.push(ADMIN_LANDINGS_GENERATE_FROM_TAXONOMY_ROUTE);
  }

  async function handlePublishRow(item: AdminLandingListItem) {
    setRowBusyId(item.id);
    try {
      await publishAdminLandingClient(item.id);
      showToast("success", `「${item.title}」랜딩을 공개했습니다.`);
      await loadItems();
    } catch (e) {
      if (e instanceof AdminLandingPublishClientError) {
        const summary = e.issues.map((i) => i.message).join(" · ");
        showToast("error", summary || "Publish 검증에 실패했습니다. 편집 화면에서 상세 사유를 확인하세요.");
        return;
      }
      showToast("error", e instanceof Error ? e.message : "Publish에 실패했습니다.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleUnpublishRow(item: AdminLandingListItem) {
    setRowBusyId(item.id);
    try {
      await unpublishAdminLandingClient(item.id);
      showToast("success", `「${item.title}」랜딩을 비공개했습니다.`);
      await loadItems();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Unpublish에 실패했습니다.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !confirm(
        `선택한 ${ids.length}개 랜딩을 삭제할까요? 연결된 섹션도 함께 삭제되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteAdminLandingClient(id)));
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      const ok = results.length - failed.length;
      if (failed.length === 0) {
        showToast("success", `${ok}개 랜딩을 삭제했습니다.`);
      } else {
        const firstMsg =
          failed[0]?.reason instanceof Error ? failed[0].reason.message : String(failed[0]?.reason ?? "");
        showToast("error", `${ok}개 삭제됨, ${failed.length}개 실패. ${firstMsg}`);
      }
      setSelectedIds(new Set());
      await loadItems();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">랜딩 목록</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Publish는 검증을 통과한 경우에만 공개되며, Unpublish 시 즉시 공개 URL에서 제외됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isClient ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleBulkDelete();
                }}
                disabled={deleteBusy || selectedIds.size === 0}
                className="rounded-lg border border-[var(--danger)]/40 bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteBusy ? "삭제 중…" : `선택 삭제${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
              </button>
              <button
                type="button"
                onClick={handleGenerateClick}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]/70"
              >
                taxonomy에서 draft 생성
              </button>
              <button
                type="button"
                onClick={handleCreateClick}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
              >
                랜딩 생성
              </button>
            </>
          ) : (
            <>
              <div
                className="h-[38px] min-w-[7.5rem] rounded-lg border border-[var(--danger)]/40 bg-[var(--surface-muted)]"
                aria-hidden
              />
              <div
                className="h-[38px] min-w-[11.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]"
                aria-hidden
              />
              <div
                className="h-[38px] min-w-[5.5rem] rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)]"
                aria-hidden
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">총 랜딩 수</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">공개 랜딩 수</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{summary.published}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">드래프트 수</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{summary.draft}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-12 text-center text-sm text-[var(--text-muted)]">
          랜딩 목록을 불러오는 중입니다...
        </div>
      ) : error ? (
        <AdminLandingEmptyState
          title={ADMIN_LANDINGS_ERROR_TITLE}
          description={error || ADMIN_LANDINGS_ERROR_DESCRIPTION}
          retryLabel="다시 시도"
          createLabel="랜딩 생성"
          onRetry={() => {
            void loadItems();
          }}
          onCreate={handleCreateClick}
        />
      ) : items.length === 0 ? (
        <AdminLandingEmptyState
          title={ADMIN_LANDINGS_EMPTY_TITLE}
          description={ADMIN_LANDINGS_EMPTY_DESCRIPTION}
          createLabel="랜딩 생성"
          onCreate={handleCreateClick}
        />
      ) : (
        <AdminLandingListTable
          items={items}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          selectionDisabled={deleteBusy}
          busyId={rowBusyId}
          onEdit={(item) => {
            router.push(buildAdminLandingEditHref(item.id));
          }}
          onPreview={(item) => {
            router.push(buildAdminLandingPreviewHref(item.id));
          }}
          onPublish={(item) => {
            void handlePublishRow(item);
          }}
          onUnpublish={(item) => {
            void handleUnpublishRow(item);
          }}
        />
      )}
    </section>
  );
}
