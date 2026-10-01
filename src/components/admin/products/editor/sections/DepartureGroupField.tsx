"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import {
  ADMIN_PRODUCTS_QUERY_KEYS,
  ADMIN_PRODUCTS_VIEW,
} from "@/components/admin/products/adminProducts.constants";
import type { AdminDepartureSibling } from "@/lib/products/departureSiblings";
import type { ProductFormState } from "@/types/adminProductForm";

function siblingEditorHref(id: string): string {
  const params = new URLSearchParams({
    [ADMIN_PRODUCTS_QUERY_KEYS.VIEW]: ADMIN_PRODUCTS_VIEW.CREATE,
    [ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID]: id,
  });
  return `/theall_manager_only/products?${params.toString()}`;
}

/** 출발지 입력 + 같은 묶음(출발지별로 나눠 등록한) 형제 상품 목록 */
export function DepartureGroupField({
  form,
  setForm,
  editingId,
}: {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  editingId?: string | null;
}) {
  const groupId = form.departure_group_id;
  const requestKey = editingId && groupId ? `${editingId}:${groupId}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    siblings: AdminDepartureSibling[];
    error: string | null;
  } | null>(null);
  const current = loaded && loaded.key === requestKey ? loaded : null;
  const siblings = current?.siblings ?? [];
  const loadError = current?.error ?? null;

  useEffect(() => {
    if (!requestKey || !editingId) return;
    let cancelled = false;
    const fail = (message: string) => {
      if (!cancelled) setLoaded({ key: requestKey, siblings: [], error: message });
    };
    fetch(`/api/admin/products/${editingId}/departure-siblings`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | { siblings?: AdminDepartureSibling[]; message?: string }
          | null;
        if (!res.ok) return fail(data?.message ?? "형제 상품을 불러오지 못했습니다.");
        if (!cancelled) setLoaded({ key: requestKey, siblings: data?.siblings ?? [], error: null });
      })
      .catch(() => fail("형제 상품을 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [requestKey, editingId]);

  return (
    <div className="space-y-1 md:col-span-2">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">출발지</span>
        <input
          value={form.departure_city}
          onChange={(event) => setForm((prev) => ({ ...prev, departure_city: event.target.value }))}
          placeholder="예: 인천, 부산"
          className="w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
        <span className="text-[11px] text-[var(--text-muted)]">
          상세의 출발지역과 출발지 전환 칩에 표시됩니다.
        </span>
      </label>
      {groupId ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--text-primary)]">같은 상품의 다른 출발지</p>
          {requestKey && !current ? (
            <p className="mt-1 text-[var(--text-secondary)]">불러오는 중…</p>
          ) : loadError ? (
            <p className="mt-1 text-[var(--danger)]">{loadError}</p>
          ) : siblings.length === 0 ? (
            <p className="mt-1 text-[var(--text-secondary)]">묶인 다른 출발지 상품이 없습니다.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {siblings.map((sibling) => (
                <li key={sibling.id} className="flex flex-wrap items-center gap-2">
                  <Link href={siblingEditorHref(sibling.id)} className="font-medium text-[var(--primary)] underline">
                    {sibling.departure_city ? `${sibling.departure_city}출발` : "출발지 미입력"}
                  </Link>
                  <span className="min-w-0 truncate text-[var(--text-secondary)]">{sibling.title}</span>
                  <span className={sibling.is_active ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>
                    {sibling.is_active ? "노출 중" : "비노출"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            상세 페이지의 출발지 칩에는 노출 중이고 출발지가 입력된 상품만 나타납니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
