"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import AdminLandingEmptyState from "@/components/admin/landings/AdminLandingEmptyState";
import AdminLandingListTable from "@/components/admin/landings/AdminLandingListTable";
import { listAdminLandingsClient } from "@/components/admin/landings/api/adminLandings.client";
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

export default function AdminLandingManager() {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<AdminLandingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <section className="space-y-6 rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">랜딩 목록</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            후속 PR에서 DB/API/편집기/미리보기가 연결됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          onEdit={(item) => {
            router.push(buildAdminLandingEditHref(item.id));
          }}
          onPreview={(item) => {
            router.push(buildAdminLandingPreviewHref(item.id));
          }}
        />
      )}
    </section>
  );
}
