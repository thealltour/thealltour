"use client";

import { useEffect, useMemo, useState } from "react";

type AdminReviewItem = {
  id: string;
  member_id: string;
  member_username: string | null;
  author_name: string;
  title: string;
  content: string;
  image_url: string | null;
  image_urls: string[];
  created_at: string | null;
};

type ReviewForm = {
  author_name: string;
  title: string;
  content: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export default function AdminReviewTable() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ReviewForm | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pageSize = 8;

  async function loadReviews() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/reviews", { cache: "no-store" });
      const result = (await response.json()) as AdminReviewItem[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "후기 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "후기 목록 조회에 실패했습니다.");
        return;
      }
      setReviews(result as AdminReviewItem[]);
    } catch {
      setErrorMessage("후기 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.author_name.toLowerCase().includes(q) ||
        (item.member_username ?? "").toLowerCase().includes(q),
    );
  }, [reviews, search]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedReviews = filteredReviews.slice((safePage - 1) * pageSize, safePage * pageSize);

  function startEdit(item: AdminReviewItem) {
    setEditingId(item.id);
    setEditForm({
      author_name: item.author_name,
      title: item.title,
      content: item.content,
    });
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setPendingId(id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 수정에 실패했습니다.");
        return;
      }
      setReviews((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                author_name: editForm.author_name,
                title: editForm.title,
                content: editForm.content,
              }
            : item,
        ),
      );
      cancelEdit();
    } catch {
      setErrorMessage("후기 수정 중 오류가 발생했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading) {
    return <p className="px-4 py-6 text-sm text-slate-500">후기 목록을 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="px-4 pt-4">
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="제목/내용/작성자/회원아이디 검색"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </div>

      {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead className="bg-[#eff6ff] text-[#1e3a8a]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">회원아이디</th>
              <th className="px-4 py-3 text-left font-semibold">작성자</th>
              <th className="px-4 py-3 text-left font-semibold">제목</th>
              <th className="px-4 py-3 text-left font-semibold">내용</th>
              <th className="px-4 py-3 text-left font-semibold">이미지수</th>
              <th className="px-4 py-3 text-left font-semibold">작성일시</th>
              <th className="px-4 py-3 text-left font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {pagedReviews.length === 0 ? (
              <tr className="border-t border-slate-200">
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  후기 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              pagedReviews.map((item) => {
                const isEditing = editingId === item.id && editForm;
                return (
                  <tr key={item.id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3 font-medium text-[#1e3a8a]">{item.member_username ?? "-"}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.author_name}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              author_name: event.target.value,
                            })
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.author_name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.title}
                          onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                          className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.title
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editForm.content}
                          onChange={(event) => setEditForm({ ...editForm, content: event.target.value })}
                          className="w-72 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        <p className="line-clamp-3 max-w-[360px] whitespace-pre-line text-slate-700">
                          {item.content}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.image_urls.length > 0
                        ? item.image_urls.length
                        : item.image_url
                          ? 1
                          : 0}
                    </td>
                    <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pendingId === item.id}
                            onClick={() => saveEdit(item.id)}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === item.id}
                            onClick={cancelEdit}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 pb-4 text-sm text-slate-600">
        <p>
          총 {filteredReviews.length}건 중 {filteredReviews.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
          {Math.min(safePage * pageSize, filteredReviews.length)}건 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
