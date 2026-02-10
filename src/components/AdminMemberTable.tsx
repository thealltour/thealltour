"use client";

import { useEffect, useMemo, useState } from "react";

type MemberItem = {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
  created_at: string | null;
};

type MemberForm = {
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
};

type SortKey = "username" | "name" | "phone" | "email" | "birth_date" | "gender" | "agree_email" | "created_at";
type SortDirection = "asc" | "desc";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function escapeCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildMembersCsv(rows: MemberItem[]) {
  const header = [
    "아이디",
    "이름",
    "연락처",
    "이메일",
    "생년월일",
    "성별",
    "이메일수신동의",
    "가입일시",
  ];
  const lines = rows.map((item) =>
    [
      item.username,
      item.name,
      item.phone,
      item.email,
      item.birth_date,
      item.gender,
      item.agree_email ? "동의" : "미동의",
      formatDate(item.created_at),
    ]
      .map((value) => escapeCsvValue(String(value)))
      .join(","),
  );
  return [header.map((value) => escapeCsvValue(value)).join(","), ...lines].join("\n");
}

function getDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SortButton({
  label,
  isActive,
  direction,
  onClick,
}: {
  label: string;
  isActive: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition ${
        isActive ? "bg-[#dbeafe] text-[#1d4ed8]" : "text-[#1e3a8a] hover:bg-[#e8f0ff]"
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px] leading-none">
        {isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export default function AdminMemberTable() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showAgreeEmailOnly, setShowAgreeEmailOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MemberForm | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pageSize = 8;

  async function loadMembers() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      const result = (await response.json()) as MemberItem[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "회원 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "회원 목록 조회에 실패했습니다.");
        return;
      }
      setMembers(result as MemberItem[]);
    } catch {
      setErrorMessage("회원 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = !q
      ? members
      : members.filter(
      (item) =>
        item.username.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q),
    );

    if (!showAgreeEmailOnly) return searched;
    return searched.filter((item) => item.agree_email);
  }, [members, search, showAgreeEmailOnly]);

  const agreeEmailCount = useMemo(
    () => members.filter((item) => item.agree_email).length,
    [members],
  );
  const agreeEmailMembers = useMemo(
    () => members.filter((item) => item.agree_email),
    [members],
  );

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "agree_email") {
        return ((a.agree_email ? 1 : 0) - (b.agree_email ? 1 : 0)) * multiplier;
      }
      if (sortKey === "created_at") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (aTime - bTime) * multiplier;
      }

      const aValue = String(a[sortKey] ?? "");
      const bValue = String(b[sortKey] ?? "");
      return aValue.localeCompare(bValue, "ko") * multiplier;
    });
  }, [filteredMembers, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedMembers = sortedMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  function downloadCsv(fileName: string, rows: MemberItem[]) {
    if (rows.length === 0) {
      setErrorMessage("다운로드할 회원 데이터가 없습니다.");
      return;
    }
    const csvContent = "\uFEFF" + buildMembersCsv(rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
    setPage(1);
  }

  function startEdit(item: MemberItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      phone: item.phone,
      email: item.email,
      birth_date: item.birth_date,
      gender: item.gender,
      agree_email: item.agree_email,
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
      const response = await fetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "회원 정보 수정에 실패했습니다.");
        return;
      }
      setMembers((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                name: editForm.name,
                phone: editForm.phone,
                email: editForm.email,
                birth_date: editForm.birth_date,
                gender: editForm.gender,
                agree_email: editForm.agree_email,
              }
            : item,
        ),
      );
      cancelEdit();
    } catch {
      setErrorMessage("회원 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading) {
    return <p className="px-4 py-6 text-sm text-slate-500">회원 목록을 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="아이디/이름/연락처/이메일 검색"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showAgreeEmailOnly}
              onChange={(event) => {
                setShowAgreeEmailOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            이메일수신 동의 회원만 보기
          </label>
        </div>
        <span className="text-xs text-slate-500">
          이메일 동의 회원: {agreeEmailCount}명
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4">
        <button
          type="button"
          onClick={() =>
            downloadCsv(`members-agree-email-${getDateStamp()}.csv`, agreeEmailMembers)
          }
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          동의회원 전체 CSV 다운로드
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`members-current-filter-${getDateStamp()}.csv`, sortedMembers)
          }
          className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          현재 검색된 회원 전체 CSV 다운로드
        </button>
      </div>

      {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-[#eff6ff] text-[#1e3a8a]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="아이디"
                  isActive={sortKey === "username"}
                  direction={sortDirection}
                  onClick={() => handleSort("username")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="이름"
                  isActive={sortKey === "name"}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="연락처"
                  isActive={sortKey === "phone"}
                  direction={sortDirection}
                  onClick={() => handleSort("phone")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="이메일"
                  isActive={sortKey === "email"}
                  direction={sortDirection}
                  onClick={() => handleSort("email")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="생년월일"
                  isActive={sortKey === "birth_date"}
                  direction={sortDirection}
                  onClick={() => handleSort("birth_date")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="성별"
                  isActive={sortKey === "gender"}
                  direction={sortDirection}
                  onClick={() => handleSort("gender")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="이메일수신"
                  isActive={sortKey === "agree_email"}
                  direction={sortDirection}
                  onClick={() => handleSort("agree_email")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <SortButton
                  label="가입일시"
                  isActive={sortKey === "created_at"}
                  direction={sortDirection}
                  onClick={() => handleSort("created_at")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {pagedMembers.length === 0 ? (
              <tr className="border-t border-slate-200">
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  회원 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              pagedMembers.map((item) => {
                const isEditing = editingId === item.id && editForm;
                return (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-[#1e3a8a]">{item.username}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.name}
                          onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.phone}
                          onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.phone
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.email}
                          onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                          className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.email
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.birth_date}
                          onChange={(event) => setEditForm({ ...editForm, birth_date: event.target.value })}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.birth_date
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.gender}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              gender: event.target.value as "male" | "female" | "other",
                            })
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="male">남성</option>
                          <option value="female">여성</option>
                          <option value="other">기타</option>
                        </select>
                      ) : item.gender === "male" ? (
                        "남성"
                      ) : item.gender === "female" ? (
                        "여성"
                      ) : (
                        "기타"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.agree_email}
                            onChange={(event) =>
                              setEditForm({ ...editForm, agree_email: event.target.checked })
                            }
                            className="h-4 w-4 accent-[#1d4ed8]"
                          />
                          동의
                        </label>
                      ) : item.agree_email ? (
                        "동의"
                      ) : (
                        "미동의"
                      )}
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
          총 {sortedMembers.length}건 중 {sortedMembers.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
          {Math.min(safePage * pageSize, sortedMembers.length)}건 표시
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
