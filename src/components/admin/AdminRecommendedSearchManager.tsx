"use client";

import { useEffect, useState } from "react";

type RecommendedKeyword = {
  id: string;
  keyword: string;
  sortOrder: number;
  isActive: boolean;
};

type EditRow = RecommendedKeyword & { isNew?: boolean };

export default function AdminRecommendedSearchManager() {
  const [items, setItems] = useState<EditRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await fetch("/api/search/recommended?includeInactive=true", {
          cache: "no-store",
        });
        const result = (await response.json()) as { items?: RecommendedKeyword[]; message?: string };
        if (!response.ok || !result.items) {
          setErrorMessage(result.message ?? "추천 검색어를 불러오지 못했습니다.");
          return;
        }
        setItems(
          result.items.map((item) => ({
            ...item,
            sortOrder: item.sortOrder ?? 0,
          })),
        );
      } catch {
        setErrorMessage("추천 검색어 조회 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleLocalChange(id: string, patch: Partial<EditRow>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function handleSaveRow(row: EditRow) {
    if (!row.keyword.trim()) {
      setErrorMessage("키워드를 입력해 주세요.");
      return;
    }
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      if (row.isNew) {
        const response = await fetch("/api/search/recommended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: row.keyword,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          }),
        });
        const result = (await response.json()) as { item?: RecommendedKeyword; message?: string };
        if (!response.ok || !result.item) {
          setErrorMessage(result.message ?? "추천 검색어 추가에 실패했습니다.");
          return;
        }
        const createdItem: EditRow = { ...result.item, isNew: false };
        setItems((prev) =>
          prev.map((item) => (item.id === row.id ? createdItem : item)),
        );
        setMessage("추천 검색어를 추가했습니다.");
      } else {
        const response = await fetch(`/api/search/recommended/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: row.keyword,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          }),
        });
        const result = (await response.json()) as { item?: RecommendedKeyword; message?: string };
        if (!response.ok || !result.item) {
          setErrorMessage(result.message ?? "추천 검색어 수정에 실패했습니다.");
          return;
        }
        const updatedItem: EditRow = { ...result.item, isNew: false };
        setItems((prev) =>
          prev.map((item) => (item.id === row.id ? updatedItem : item)),
        );
        setMessage("추천 검색어를 저장했습니다.");
      }
    } catch {
      setErrorMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteRow(row: EditRow) {
    if (row.isNew) {
      setItems((prev) => prev.filter((item) => item.id !== row.id));
      return;
    }
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/search/recommended/${row.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "추천 검색어 삭제에 실패했습니다.");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== row.id));
      setMessage("추천 검색어를 삭제했습니다.");
    } catch {
      setErrorMessage("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddRow() {
    const tempId = `new-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        id: tempId,
        keyword: "",
        sortOrder: prev.length ? prev[prev.length - 1].sortOrder + 1 : 0,
        isActive: true,
        isNew: true,
      },
    ]);
  }

  return (
    <section className="space-y-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            추천 검색어 관리
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            메인 검색창 포커스 시 노출되는 추천 검색어를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-strong)]"
          disabled={isSaving}
        >
          + 추천 검색어 추가
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">
          추천 검색어를 불러오는 중입니다...
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-600">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs text-red-500">{errorMessage}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--card-muted)]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">
                정렬 순서
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">
                키워드
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">
                활성화
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-muted)]">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 align-middle">
                  <input
                    type="number"
                    value={row.sortOrder}
                    onChange={(event) =>
                      handleLocalChange(row.id, {
                        sortOrder: Number(event.target.value),
                      })
                    }
                    className="w-20 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <input
                    type="text"
                    value={row.keyword}
                    onChange={(event) =>
                      handleLocalChange(row.id, { keyword: event.target.value })
                    }
                    className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                    placeholder="예: 동남아 골프, 유럽 여행"
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(event) =>
                        handleLocalChange(row.id, { isActive: event.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <span>{row.isActive ? "사용" : "숨김"}</span>
                  </label>
                </td>
                <td className="px-3 py-2 text-right align-middle">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSaveRow(row)}
                      disabled={isSaving}
                      className="rounded-md bg-[var(--brand)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row)}
                      disabled={isSaving}
                      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--card-muted)] disabled:opacity-60"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-xs text-[var(--text-muted)]"
                >
                  등록된 추천 검색어가 없습니다. 상단의 &quot;추천 검색어 추가&quot; 버튼으로
                  새 항목을 추가하세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

