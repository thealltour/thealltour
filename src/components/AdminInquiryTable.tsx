"use client";

import { useEffect, useMemo, useState } from "react";
import type { Inquiry } from "@/types/inquiry";

function formatDate(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export default function AdminInquiryTable() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "unset">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  async function loadInquiries(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage("");
      const response = await fetch("/api/inquiries", { cache: "no-store" });
      if (!response.ok) {
        setErrorMessage("문의 목록을 불러오지 못했습니다.");
        return;
      }

      const data = (await response.json()) as Inquiry[];
      setInquiries(data);
    } catch {
      setErrorMessage("문의 목록 조회 중 오류가 발생했습니다.");
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadInquiries();
  }, []);

  async function updateCompletion(id: string, isCompleted: boolean) {
    setPendingId(id);
    setErrorMessage("");

    const previous = inquiries;
    setInquiries((current) =>
      current.map((item) => (item.id === id ? { ...item, is_completed: isCompleted } : item)),
    );

    try {
      const response = await fetch(`/api/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      });

      if (!response.ok) {
        setInquiries(previous);
        setErrorMessage("상담 완료 상태 변경에 실패했습니다.");
      }
    } catch {
      setInquiries(previous);
      setErrorMessage("상담 완료 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  const filteredInquiries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        inquiry.name.toLowerCase().includes(normalizedQuery) ||
        inquiry.phone.toLowerCase().includes(normalizedQuery) ||
        inquiry.content.toLowerCase().includes(normalizedQuery) ||
        (inquiry.product_title ?? "").toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;

      const completion =
        typeof inquiry.is_completed === "boolean"
          ? inquiry.is_completed
            ? "completed"
            : "pending"
          : "unset";

      return statusFilter === "all" ? true : completion === statusFilter;
    });
  }, [inquiries, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInquiries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedInquiries = filteredInquiries.slice((safePage - 1) * pageSize, safePage * pageSize);

  function movePage(nextPage: number) {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
  }

  if (isLoading) {
    return <p className="px-4 py-6 text-sm text-slate-500">문의 목록을 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-col gap-2 text-xs font-semibold text-slate-500">
            검색(이름/연락처/문의내용)
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="검색어를 입력하세요"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
            상담 상태
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | "completed" | "pending" | "unset");
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="all">전체</option>
              <option value="completed">완료</option>
              <option value="pending">진행중</option>
              <option value="unset">미설정</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => loadInquiries({ silent: true })}
          disabled={isRefreshing}
          className="rounded-lg border border-[#bfdbfe] bg-white px-3 py-2 text-sm font-medium text-[#1e3a8a] transition hover:bg-[#eff6ff] disabled:cursor-not-allowed"
        >
          {isRefreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {errorMessage ? <p className="px-4 pt-4 text-sm text-red-500">{errorMessage}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-[#eff6ff] text-[#1e3a8a]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">고객명</th>
              <th className="px-4 py-3 text-left font-semibold">연락처</th>
              <th className="px-4 py-3 text-left font-semibold">유입 상품</th>
              <th className="px-4 py-3 text-left font-semibold">문의 내용</th>
              <th className="px-4 py-3 text-left font-semibold">문의일시</th>
              <th className="px-4 py-3 text-left font-semibold">상담 완료</th>
            </tr>
          </thead>
          <tbody>
            {pagedInquiries.length === 0 ? (
              <tr className="border-t border-slate-200">
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            ) : (
              pagedInquiries.map((inquiry) => {
                // If schema has no is_completed column yet, keep list visible and disable toggling.
                const canUpdateCompletion = typeof inquiry.is_completed === "boolean";
                const isCompleted = Boolean(inquiry.is_completed);

                return (
                  <tr key={inquiry.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-[#1e3a8a]">{inquiry.name}</td>
                    <td className="px-4 py-3">{inquiry.phone}</td>
                    <td className="px-4 py-3">
                      {inquiry.product_title ? (
                        <div className="space-y-1">
                          <p className="font-medium text-slate-700">{inquiry.product_title}</p>
                          {inquiry.source_path ? (
                            <p className="text-xs text-slate-500">{inquiry.source_path}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">일반 문의</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{inquiry.content}</td>
                    <td className="px-4 py-3">{formatDate(inquiry.created_at ?? "")}</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          disabled={pendingId === inquiry.id || !canUpdateCompletion}
                          onChange={(event) => {
                            if (!canUpdateCompletion) return;
                            updateCompletion(inquiry.id, event.target.checked);
                          }}
                          className="h-4 w-4 accent-[#1d4ed8]"
                        />
                        <span
                          className={`text-xs font-semibold ${isCompleted ? "text-green-600" : "text-slate-500"}`}
                        >
                          {canUpdateCompletion ? (isCompleted ? "완료" : "진행중") : "미설정"}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 pb-4 pt-1 text-sm text-slate-600">
        <p>
          총 {filteredInquiries.length}건 중 {filteredInquiries.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
          -
          {Math.min(safePage * pageSize, filteredInquiries.length)}건 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => movePage(safePage - 1)}
            disabled={safePage <= 1}
            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => movePage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
