# 회원관리/포인트/리워드 사전 발췌

아래는 요청하신 파일의 전체 원문입니다.

## 참고: 경로 없음
- src/components/admin/members/**/* (해당 디렉터리 없음; 회원 목록은 src/components/admin/AdminMemberTable.tsx 사용)
- src/lib/admin/members/**/* (해당 디렉터리 없음)
- src/lib/members/**/* (해당 디렉터리 없음)

## FILE: src/app/theall_manager_only/members/page.tsx

```ts
export { default } from "@/app/admin/members/page";

```

## FILE: src/app/admin/members/page.tsx

```ts
import AdminHeader from "@/components/admin/AdminHeader";
import AdminMemberTable from "@/components/admin/AdminMemberTable";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminMembersPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="members"
          title="회원 관리"
          description="회원 정보를 검색하고 연락처/이메일/동의 여부 등을 수정할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminMemberTable />
        </section>
      </main>
    </div>
  );
}

```

## FILE: src/components/admin/AdminMemberTable.tsx

```ts
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
  points: number;
  created_at: string | null;
};

type MemberForm = {
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
  points: string;
};

type SortKey =
  | "username"
  | "name"
  | "phone"
  | "email"
  | "birth_date"
  | "gender"
  | "agree_email"
  | "points"
  | "created_at";
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
    "포인트",
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
      item.points,
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
        isActive ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--primary)] hover:bg-[var(--primary-soft)]"
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

      if (sortKey === "points") {
        return ((a.points ?? 0) - (b.points ?? 0)) * multiplier;
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
      points: String(item.points ?? 0),
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
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          birth_date: editForm.birth_date,
          gender: editForm.gender,
          agree_email: editForm.agree_email,
          points: Number(editForm.points.replace(/,/g, "")),
        }),
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
                points: Number(editForm.points.replace(/,/g, "")) || 0,
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
    return <p className="px-4 py-6 text-sm text-[var(--text-muted)]">회원 목록을 불러오는 중입니다...</p>;
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
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={showAgreeEmailOnly}
              onChange={(event) => {
                setShowAgreeEmailOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            이메일수신 동의 회원만 보기
          </label>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          이메일 동의 회원: {agreeEmailCount}명
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4">
        <button
          type="button"
          onClick={() =>
            downloadCsv(`members-agree-email-${getDateStamp()}.csv`, agreeEmailMembers)
          }
          className="rounded border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition hover:bg-[color:color-mix(in_oklab,var(--success)_8%,transparent)]"
        >
          동의회원 전체 CSV 다운로드
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`members-current-filter-${getDateStamp()}.csv`, sortedMembers)
          }
          className="rounded border border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)]"
        >
          현재 검색된 회원 전체 CSV 다운로드
        </button>
      </div>

      {errorMessage ? <p className="px-4 text-sm text-[var(--danger)]">{errorMessage}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
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
                  label="포인트"
                  isActive={sortKey === "points"}
                  direction={sortDirection}
                  onClick={() => handleSort("points")}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                포인트(P)
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
              <tr className="border-t border-[var(--divider)]">
                <td colSpan={9} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  회원 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              pagedMembers.map((item) => {
                const isEditing = editingId === item.id && editForm;
                return (
                  <tr key={item.id} className="border-t border-[var(--divider)]">
                    <td className="px-4 py-3 font-medium text-[var(--primary)]">{item.username}</td>
                <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.name}
                          onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                          className="w-28 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                          className="w-32 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                          className="w-44 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          동의
                        </label>
                      ) : item.agree_email ? (
                        "동의"
                      ) : (
                        "미동의"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.points}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/[^\d]/g, "");
                            const formatted = raw ? Number(raw).toLocaleString("ko-KR") : "0";
                            setEditForm({ ...editForm, points: formatted });
                          }}
                          className="w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-right text-[var(--text-primary)]"
                        />
                      ) : (
                        <span className="tabular-nums">
                          {Number(item.points ?? 0).toLocaleString("ko-KR")}P
                        </span>
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
                            className="rounded border border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--primary)]"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === item.id}
                            onClick={cancelEdit}
                            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)]"
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

      <div className="flex items-center justify-between px-4 pb-4 text-sm text-[var(--text-secondary)]">
        <p>
          총 {sortedMembers.length}건 중 {sortedMembers.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
          {Math.min(safePage * pageSize, sortedMembers.length)}건 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

```

## FILE: src/app/api/admin/members/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  let query = supabase
    .from("members")
    .select("id,username,name,phone,email,birth_date,gender,agree_email,point_balance,point_pending,points,created_at")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,phone.ilike.%${search}%,name.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "회원 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

```

## FILE: src/app/api/admin/members/[id]/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type MemberBody = {
  name?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  gender?: "male" | "female" | "other";
  agree_email?: boolean;
  points?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as MemberBody;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.phone !== undefined) updates.phone = body.phone.trim();
  if (body.email !== undefined) updates.email = body.email.trim();
  if (body.birth_date !== undefined) updates.birth_date = body.birth_date.trim();
  if (body.gender !== undefined) updates.gender = body.gender;
  if (body.agree_email !== undefined) updates.agree_email = body.agree_email;
  if (body.points !== undefined) {
    const value = Number.isFinite(body.points) ? Math.max(0, Math.floor(body.points)) : NaN;
    if (Number.isNaN(value)) {
      return NextResponse.json({ message: "포인트는 0 이상의 정수로 입력해 주세요." }, { status: 400 });
    }
    updates.points = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase.from("members").update(updates).eq("id", id).select("id").maybeSingle();
  if (result.error) {
    return NextResponse.json({ message: "회원 정보 수정에 실패했습니다." }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json(
      { message: "회원 정보 수정 권한이 없거나 대상 회원을 찾지 못했습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ message: "회원 정보가 수정되었습니다." });
}

```

## FILE: src/app/api/admin/members/[id]/points/grant/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 포인트 수동 지급 (원장 기록 포함) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: memberId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { amount?: number; reason?: string };
  const amount = Number(body.amount);
  const reason = body.reason?.trim() || "관리자 지급";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "지급 포인트는 1 이상의 숫자로 입력해 주세요." }, { status: 400 });
  }

  const { data: memberRow } = await supabase.from("members").select("points").eq("id", memberId).maybeSingle();
  if (!memberRow) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const currentPoints = Number((memberRow as { points?: number }).points ?? 0);
  const newBalance = currentPoints + amount;

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: memberId,
      type: "EARN",
      status: "CONFIRMED",
      amount,
      reason,
      ref_type: "manual",
      ref_id: null,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  const { error: updateErr } = await supabase.from("members").update({ points: newBalance }).eq("id", memberId);
  if (updateErr) {
    return NextResponse.json({ message: "회원 포인트 반영에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: `${amount}P 지급되었습니다. (잔액: ${newBalance}P)` });
}

```

## FILE: src/app/api/admin/members/[id]/point-ledger/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

const LIMIT = 100;

/** 관리자: 특정 회원의 포인트 원장(지급/사용 등) 목록 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || LIMIT));

  const { data, error } = await supabase
    .from("point_ledger")
    .select("id, type, status, amount, reason, ref_type, ref_id, expires_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: "포인트 내역을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

```

## FILE: src/app/api/members/register/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createPasswordHash } from "@/lib/password";
import { createNewMemberNotification } from "@/lib/adminNotifications";
import type { MemberSignupInput } from "@/types/member";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<MemberSignupInput>;
  const username = body.username?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const phone = normalizePhone(body.phone?.trim() ?? "");
  const email = body.email?.trim() ?? "";
  const birthDate = body.birthDate?.trim() ?? "";
  const gender = body.gender;
  const agreeTerms = body.agreeTerms === true;
  const agreePrivacy = body.agreePrivacy === true;
  const agreeEmail = body.agreeEmail === true;

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { message: "아이디는 4~20자 영문/숫자/밑줄(_)만 가능합니다." },
      { status: 400 },
    );
  }
  if (name.length < 2 || name.length > 30) {
    return NextResponse.json({ message: "이름은 2~30자로 입력해 주세요." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ message: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ message: "연락처를 정확히 입력해 주세요." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!birthDate) {
    return NextResponse.json({ message: "생년월일을 입력해 주세요." }, { status: 400 });
  }
  if (gender !== "male" && gender !== "female" && gender !== "other") {
    return NextResponse.json({ message: "성별을 선택해 주세요." }, { status: 400 });
  }
  if (!agreeTerms || !agreePrivacy) {
    return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
  }

  const duplicateCheck = await supabase
    .from("members")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (duplicateCheck.error) {
    return NextResponse.json({ message: "가입 검증 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (duplicateCheck.data) {
    return NextResponse.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const { hash, salt } = createPasswordHash(password);

  const insertResult = await supabase
    .from("members")
    .insert({
      username,
      name,
      password_hash: hash,
      password_salt: salt,
      phone,
      email,
      birth_date: birthDate,
      gender,
      agree_terms: agreeTerms,
      agree_privacy: agreePrivacy,
      agree_email: agreeEmail,
    })
    .select("id,username,name")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "회원가입에 실패했습니다." }, { status: 500 });
  }

  await createNewMemberNotification({
    memberId: String(insertResult.data.id),
    username: String(insertResult.data.username),
    name: String(insertResult.data.name),
  });

  return NextResponse.json({ message: "회원가입이 완료되었습니다." }, { status: 201 });
}

```

## FILE: src/app/api/members/login/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { createMemberSessionToken, MEMBER_AUTH_COOKIE } from "@/lib/memberSession";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("members")
    .select("id,username,name,password_hash,password_salt,points")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const ok = verifyPassword(password, String(data.password_salt), String(data.password_hash));
  if (!ok) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = createMemberSessionToken({
    memberId: String(data.id),
    username: String(data.username),
    name: String(data.name),
  });

  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(MEMBER_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

```

## FILE: src/app/api/members/logout/route.ts

```ts
import { NextResponse } from "next/server";
import { MEMBER_AUTH_COOKIE } from "@/lib/memberSession";

export async function POST() {
  const response = NextResponse.json({ message: "로그아웃되었습니다." });
  response.cookies.set(MEMBER_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

```

## FILE: src/app/api/members/check-id/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") ?? "").trim();

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { available: false, message: "아이디는 4~20자 영문/숫자/밑줄(_)만 가능합니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, message: "중복확인에 실패했습니다." }, { status: 500 });
  }

  const available = !data;
  return NextResponse.json({
    available,
    message: available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다.",
  });
}

```

## FILE: src/app/api/members/me/points/route.ts

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import type { PointLedgerRow } from "@/types/pointsRewardsV2";

const LEDGER_PAGE_SIZE = 30;
const PENDING_PAGE_SIZE = 20;

export async function GET() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const memberId = session.memberId;

  const [memberRes, ledgerRes, pendingRes] = await Promise.all([
    supabase.from("members").select("points, point_balance").eq("id", memberId).maybeSingle(),
    supabase
      .from("point_ledger")
      .select("id, user_id, type, status, amount, reason, ref_type, ref_id, expires_at, created_at")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE_SIZE),
    supabase
      .from("pending_points")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(PENDING_PAGE_SIZE),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }

  const member = memberRes.data as { points?: number; point_balance?: number };
  const pointBalance = Number(member.point_balance ?? member.points ?? 0);
  const ledgerRows = (ledgerRes.data ?? []) as PointLedgerRow[];
  const pendingItems = (pendingRes.data ?? []) as Array<{ amount: number }>;
  const pendingTotal = pendingItems.reduce((sum, p) => sum + Number(p.amount), 0);

  const summary = {
    pointBalance,
    pendingTotal,
    ledgerRecent: ledgerRows,
    pendingItems,
  };

  return NextResponse.json(summary);
}

```

## FILE: src/app/api/members/rewards/catalog/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RewardCatalogRow } from "@/types/pointsRewardsV2";

/** 교환 가능 경품 목록 (비로그인도 조회 가능) */
export async function GET() {
  const { data, error } = await supabase
    .from("reward_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "경품 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as RewardCatalogRow[]);
}

```

## FILE: src/app/api/members/me/rewards/redemptions/route.ts

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { validateRedemptionPolicy } from "@/lib/rewardPolicyValidation";

/** 요청 body: 레거시 필드명(reward_catalog_id, shipping_address, shipping_note) 및 목표 스키마(catalog_id, shipping_address1, user_message) 모두 수용 */
type Body = {
  reward_catalog_id?: string;
  catalog_id?: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_zip?: string;
  shipping_note?: string;
  user_message?: string;
};

/** 경품 교환 신청 — reward_redemptions + RESERVE 원장 + 잔액 차감 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const catalogId = (body.catalog_id ?? body.reward_catalog_id)?.trim();
  const shippingName = body.shipping_name?.trim();
  const shippingPhone = body.shipping_phone?.trim();
  const shippingAddress1 = (body.shipping_address1 ?? body.shipping_address)?.trim();
  const shippingAddress2 = body.shipping_address2?.trim() || null;
  const shippingZip = body.shipping_zip?.trim() || null;
  const userMessage = (body.user_message ?? body.shipping_note)?.trim() || null;

  if (!catalogId || !shippingName || !shippingPhone || !shippingAddress1) {
    return NextResponse.json(
      { message: "경품 선택과 수령인 이름, 연락처, 주소는 필수입니다." },
      { status: 400 },
    );
  }

  const userId = session.memberId;

  const [memberRes, catalogRes] = await Promise.all([
    supabase.from("members").select("point_balance, points").eq("id", userId).maybeSingle(),
    supabase
      .from("reward_catalog")
      .select("id, title, point_cost, point_price, stock, stock_count, is_active")
      .eq("id", catalogId)
      .maybeSingle(),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (catalogRes.error || !catalogRes.data) {
    return NextResponse.json({ message: "해당 경품을 찾을 수 없습니다." }, { status: 404 });
  }

  const catalog = catalogRes.data as {
    id: string;
    title: string;
    point_cost?: number;
    point_price?: number;
    stock?: number | null;
    stock_count?: number;
    is_active: boolean;
  };
  if (!catalog.is_active) {
    return NextResponse.json({ message: "현재 교환 불가한 경품입니다." }, { status: 400 });
  }
  const stock = catalog.stock ?? catalog.stock_count;
  if (typeof stock === "number" && stock <= 0) {
    return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
  }

  const pointCost = Number(catalog.point_cost ?? catalog.point_price ?? 0);
  const member = memberRes.data as { point_balance?: number; points?: number };
  const pointBalance = Number(member.point_balance ?? member.points ?? 0);
  if (pointBalance < pointCost) {
    return NextResponse.json(
      { message: `보유 포인트가 부족합니다. (필요: ${pointCost}P, 보유: ${pointBalance}P)` },
      { status: 400 },
    );
  }

  const policyResult = await validateRedemptionPolicy(userId, pointCost, supabase);
  if (!policyResult.ok) {
    return NextResponse.json({ message: policyResult.message }, { status: 400 });
  }

  const insertRow = {
    user_id: userId,
    catalog_id: catalog.id,
    status: "REQUESTED" as const,
    point_amount: pointCost,
    user_message: userMessage,
    shipping_name: shippingName,
    shipping_phone: shippingPhone,
    shipping_address1: shippingAddress1,
    shipping_address2: shippingAddress2,
    shipping_zip: shippingZip,
  };

  const { data: redemption, error: insErr } = await supabase
    .from("reward_redemptions")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  if (insErr || !redemption) {
    return NextResponse.json({ message: "교환 신청 생성에 실패했습니다." }, { status: 500 });
  }

  const redemptionId = (redemption as { id: string }).id;

  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RESERVE",
    status: "CONFIRMED",
    amount: pointCost,
    reason: "경품 교환 신청",
    ref_type: "REDEMPTION",
    ref_id: redemptionId,
  });

  if (ledgerErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 예약 기록에 실패했습니다." }, { status: 500 });
  }

  const newBalance = pointBalance - pointCost;
  const updatePayload: { point_balance?: number; points?: number } = {};
  if (member.point_balance !== undefined) {
    updatePayload.point_balance = newBalance;
  } else {
    updatePayload.points = newBalance;
  }
  const { error: updateErr } = await supabase.from("members").update(updatePayload).eq("id", userId);

  if (updateErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 차감 반영에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 신청 접수",
    body: "경품 교환 신청이 접수되었습니다. 승인 후 발송됩니다.",
  });

  return NextResponse.json(
    { message: "교환 신청이 완료되었습니다. 승인 후 발송됩니다.", id: redemptionId },
    { status: 201 },
  );
}

```

## FILE: src/lib/memberSession.ts

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const MEMBER_AUTH_COOKIE = "theall_member_auth";

export type MemberSessionPayload = {
  memberId: string;
  username: string;
  name: string;
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

function getMemberSessionSecret() {
  return process.env.MEMBER_SESSION_SECRET ?? "";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadBase64: string) {
  const secret = getMemberSessionSecret();
  if (!secret) {
    throw new Error("MEMBER_SESSION_SECRET 환경변수가 필요합니다.");
  }
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

export function createMemberSessionToken(payload: MemberSessionPayload) {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyMemberSessionToken(token?: string | null): MemberSessionPayload | null {
  if (!token) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  let expectedSignature = "";
  try {
    expectedSignature = sign(payloadBase64);
  } catch {
    return null;
  }

  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expectedSignature, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadBase64)) as Partial<MemberSessionPayload>;
    if (!parsed.memberId || !parsed.username || !parsed.name) return null;
    return {
      memberId: parsed.memberId,
      username: parsed.username,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export function getMemberSessionFromCookies(cookies: CookieReader) {
  const token = cookies.get(MEMBER_AUTH_COOKIE)?.value;
  return verifyMemberSessionToken(token);
}

```

## FILE: src/types/member.ts

```ts
export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  pointBalance: number;
  pointPending: number;
  role: "USER" | "ADMIN";
  createdAt: string;
};

export type PointLedgerItem = {
  id: string;
  type: "EARN" | "USE" | "ADJUST" | "EXPIRE";
  status: "PENDING" | "CONFIRMED";
  amount: number;
  reason: string;
  createdAt: string;
  expiresAt?: string;
};

export type RewardCatalogItem = {
  id: string;
  title: string;
  pointCost: number;
  imageUrl?: string;
  isActive: boolean;
};
export type MemberSignupInput = {
  username: string;
  name: string;
  password: string;
  confirmPassword: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: "male" | "female" | "other";
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeEmail: boolean;
};

```

## FILE: src/types/pointsRewards.ts

```ts
/**
 * @deprecated 새 코드는 @/types/pointsRewardsV2 사용.
 * RewardCatalogRow 등은 pointsRewardsV2에서 import 하세요.
 * 이 파일은 호환용 re-export만 유지하며, 실제 import는 0건을 목표로 함.
 */
export type { RewardCatalogRow } from "./pointsRewardsV2";

```

## FILE: src/types/pointsRewardsV2.ts

```ts
/**
 * 포인트·경품·알림 스키마 v2 타입 (앱 목표 스키마 기준 주 사용 타입)
 * - point_ledger: user_id, type, status, amount(양수), ref_type, ref_id
 * - reward_redemptions: user_id, catalog_id, status 대문자, shipping_address1, shipping_zip, admin_memo, decided_at
 * - users 역할 = members (member_id / user_id 동일 대상)
 */

// -----------------------------------------------------------------------------
// members 확장 필드
// -----------------------------------------------------------------------------
export type MemberPointsExtension = {
  point_balance: number;
  point_pending: number;
  grade_id: string | null;
  marketing_opt_in: boolean;
};

// -----------------------------------------------------------------------------
// point_ledger
// -----------------------------------------------------------------------------
export type PointLedgerType =
  | "EARN"    // 적립
  | "USE"     // 사용(경품 등)
  | "EXPIRE"  // 소멸
  | "ADJUST"  // 조정
  | "RESERVE" // 예약(미확정)
  | "RELEASE"; // 예약 해제/확정

export type PointLedgerStatus = "PENDING" | "CONFIRMED" | "CANCELED";

export type PointLedgerRow = {
  id: string;
  user_id: string; // members.id
  type: PointLedgerType;
  status: PointLedgerStatus;
  amount: number; // 항상 양수
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};

// -----------------------------------------------------------------------------
// reward_catalog
// -----------------------------------------------------------------------------
export type RewardCatalogRow = {
  id: string;
  title: string;
  description: string | null;
  point_price: number;
  point_cost: number;
  image_url: string | null;
  stock_count: number;
  stock: number | null; // null = 무제한
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------------------------------------------
// reward_redemptions
// -----------------------------------------------------------------------------
export type RewardRedemptionStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELED";

export type RewardRedemptionRow = {
  id: string;
  user_id: string;
  catalog_id: string;
  status: RewardRedemptionStatus;
  point_amount: number;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  admin_memo: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------------------------------------------
// notifications
// -----------------------------------------------------------------------------
export type NotificationType = "REWARD_STATUS" | "POINT_EARNED" | "ADMIN_MESSAGE";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

// -----------------------------------------------------------------------------
// API/폼용
// -----------------------------------------------------------------------------
export type RewardRedemptionRequestInput = {
  catalog_id: string;
  user_message?: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2?: string;
  shipping_zip?: string;
};

```

## FILE: src/types/customerProfile.ts

```ts
/**
 * 비로그인 상담 고객 프로필.
 * 운영 기준 고객 식별용 마스터.
 */

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type CustomerProfileInput = {
  name: string;
  phone: string;
  email?: string | null;
  source?: string;
};

```

## FILE: src/components/admin/AdminPointsGrantManager.tsx

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

type Member = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  email: string | null;
  point_balance?: number;
  point_pending?: number;
  created_at: string;
};

type LedgerRow = {
  id: string;
  type: string;
  status: string;
  amount: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  EXPIRE: "소멸",
  ADJUST: "조정",
  RESERVE: "예약",
  RELEASE: "해제",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPointsGrantManager() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [grantStatus, setGrantStatus] = useState<"PENDING" | "CONFIRMED">("CONFIRMED");
  const [refType, setRefType] = useState("");
  const [refId, setRefId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/members${q}`);
      const data = await res.json();
      if (res.ok) setMembers(Array.isArray(data) ? data : []);
      else setMembers([]);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchMembers, 300);
    return () => clearTimeout(t);
  }, [fetchMembers]);

  useEffect(() => {
    if (!selected?.id) {
      setLedger([]);
      return;
    }
    setLedgerLoading(true);
    fetch(`/api/admin/members/${selected.id}/point-ledger`)
      .then((res) => res.json())
      .then((data) => {
        setLedger(Array.isArray(data) ? data : []);
      })
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false));
  }, [selected?.id]);

  const handleGrant = useCallback(async () => {
    if (!selected) {
      setMessage({ type: "err", text: "회원을 선택해 주세요." });
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setMessage({ type: "err", text: "포인트는 1 이상의 숫자여야 합니다." });
      return;
    }
    setSubmitLoading(true);
    setMessage(null);
    try {
      const expiresAtIso =
        expiresAt.trim() && !Number.isNaN(new Date(expiresAt).getTime())
          ? new Date(expiresAt).toISOString()
          : undefined;
      const res = await fetch("/api/admin/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          amount: num,
          reason: reason.trim() || "관리자 지급",
          status: grantStatus,
          refType: refType.trim() || undefined,
          refId: refId.trim() || undefined,
          expiresAt: expiresAtIso,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "지급에 실패했습니다." });
        return;
      }
      setMessage({ type: "ok", text: data.message || "지급되었습니다." });
      setAmount("");
      setReason("");
      setRefType("");
      setRefId("");
      setExpiresAt("");
      setLedger((prev) => [
        {
          id: data.ledgerId || "",
          type: "EARN",
          status: grantStatus,
          amount: num,
          reason: reason.trim() || null,
          ref_type: refType.trim() || null,
          ref_id: refId.trim() || null,
          expires_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSubmitLoading(false);
    }
  }, [selected, amount, reason, grantStatus, refType, refId, expiresAt]);

  return (
    <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">회원 검색</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">이메일·전화·이름·아이디로 검색 후 선택하세요.</p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색어 입력"
            className="input-base w-full pl-9 bg-[var(--surface-muted)]"
          />
        </div>
        <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
          {loading ? (
            <li className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">검색 중…</li>
          ) : members.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">검색 결과 없음</li>
          ) : (
            members.slice(0, 20).map((m) => (
              <li
                key={m.id}
                onClick={() => setSelected(m)}
                className={`cursor-pointer border-b border-[var(--border)] px-3 py-2 last:border-0 hover:bg-[var(--surface-muted)] ${selected?.id === m.id ? "bg-[var(--primary-soft)]" : ""}`}
              >
                <p className="font-medium text-[var(--text-primary)]">{m.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{m.email ?? m.phone ?? m.username}</p>
                <p className="text-xs text-[var(--primary)]">
                  잔액 {(m.point_balance ?? 0).toLocaleString()}P / 대기 {(m.point_pending ?? 0).toLocaleString()}P
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">포인트 지급</h3>
        {selected ? (
          <>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {selected.name} ({selected.email ?? selected.phone ?? selected.username})
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">포인트 (amount) *</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">사유 (reason) *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 출발 확정 적립"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">상태 (status)</label>
                <select
                  value={grantStatus}
                  onChange={(e) => setGrantStatus(e.target.value as "PENDING" | "CONFIRMED")}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                >
                  <option value="CONFIRMED">CONFIRMED (즉시 반영)</option>
                  <option value="PENDING">PENDING (확정 후 반영)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">refType (선택)</label>
                <input
                  type="text"
                  value={refType}
                  onChange={(e) => setRefType(e.target.value)}
                  placeholder="예: BOOKING"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">refId (선택)</label>
                <input
                  type="text"
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  placeholder="예: 예약 ID"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">expiresAt (선택)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              {message && (
                <p className={message.type === "ok" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>
                  {message.text}
                </p>
              )}
              <button
                type="button"
                onClick={handleGrant}
                disabled={submitLoading}
                className="btn-admin-primary w-full disabled:opacity-50"
              >
                {submitLoading ? "처리 중…" : "지급"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">왼쪽에서 회원을 선택하세요.</p>
        )}
      </section>

      <section className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">지급 내역 로그</h3>
        {selected ? (
          ledgerLoading ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">불러오는 중…</p>
          ) : ledger.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">내역이 없습니다.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">일시</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">유형</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">상태</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">포인트</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">사유</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">ref</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)]">
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">{formatDate(row.created_at)}</td>
                      <td className="px-3 py-2">{TYPE_LABEL[row.type] ?? row.type}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs">{row.status}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-[var(--primary)]">
                        {row.type === "EARN" ? "+" : "-"}
                        {Number(row.amount).toLocaleString()}P
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--text-secondary)]">{row.reason ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                        {row.ref_type && row.ref_id ? `${row.ref_type}:${row.ref_id}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">회원 선택 시 해당 회원의 포인트 내역이 표시됩니다.</p>
        )}
      </section>
    </div>
  );
}

```

## FILE: src/components/admin/AdminRewardsManager.tsx

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Copy,
  Check,
  Truck,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

type Member = { id: string; name: string; username: string; email: string; phone: string };
type Catalog = { id: string; title: string; point_cost: number; stock: number | null };
type Row = {
  id: string;
  user_id: string;
  catalog_id: string;
  status: string;
  point_amount: number;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  admin_memo: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  reward_catalog: Catalog | null;
  members: Member | null;
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

const MESSAGE_TEMPLATES = [
  { label: "주소 확인 요청", key: "address" as const },
  { label: "발송 완료 안내(운송장 포함)", key: "shipping" as const },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminRewardsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = searchParams.get("status") || "REQUESTED";
  const selectedId = searchParams.get("id");

  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminMemo, setAdminMemo] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [copiedContact, setCopiedContact] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const selected = selectedId ? list.find((r) => r.id === selectedId) : null;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rewards/redemptions?status=${status}`);
      const data = await res.json();
      if (res.ok) setList(Array.isArray(data) ? data : []);
      else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const runAction = useCallback(
    async (action: "approve" | "reject" | "ship" | "complete", id: string, body?: Record<string, unknown>) => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/admin/rewards/redemptions/${id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.message || "처리 실패");
          return;
        }
        setAdminMemo("");
        setRejectReason("");
        setTrackingCarrier("");
        setTrackingNumber("");
        await fetchList();
        if (action === "reject" || action === "complete") {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("id");
          router.replace(`${pathname}?${params.toString()}`);
        }
      } finally {
        setActionLoading(null);
      }
    },
    [status, fetchList, searchParams, pathname, router],
  );

  const copyContact = useCallback(() => {
    if (!selected) return;
    const text = [
      selected.shipping_name,
      selected.shipping_phone,
      [selected.shipping_address1, selected.shipping_address2].filter(Boolean).join(" "),
      selected.shipping_zip,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedContact(true);
      setTimeout(() => setCopiedContact(false), 2000);
    });
  }, [selected]);

  const buildTemplateBody = useCallback(
    (key: "address" | "shipping") => {
      if (!selected) return "";
      if (key === "address") {
        return "안녕하세요. 경품 배송을 위해 수령 주소를 확인하고자 연락드립니다. 현재 등록된 주소로 발송해도 될까요?";
      }
      const tracking = selected.tracking_number
        ? `\n운송장: ${selected.tracking_carrier ? `${selected.tracking_carrier} ` : ""}${selected.tracking_number}`
        : "";
      return `안녕하세요. 신청하신 경품 발송이 시작되었습니다.${tracking}\n수령까지 2~3일 정도 소요될 수 있습니다.`;
    },
    [selected],
  );

  const copyTemplate = useCallback((body: string) => {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedTemplate(body.slice(0, 20));
      setTimeout(() => setCopiedTemplate(null), 2000);
    });
  }, []);

  return (
    <div className="flex gap-6">
      <section className="min-w-0 flex-1 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">불러오는 중…</div>
        ) : list.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">해당 상태의 신청이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">신청일</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">회원</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">연락처</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">경품명</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">포인트</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">상태</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("id", r.id);
                      router.replace(`${pathname}?${params.toString()}`);
                    }}
                    className={`cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)] ${selectedId === r.id ? "bg-[var(--primary-soft)]" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{formatDate(r.requested_at)}</td>
                    <td className="px-4 py-3">{r.members?.name ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{(r.shipping_phone || r.members?.phone) ?? "-"}</td>
                    <td className="px-4 py-3">{r.reward_catalog?.title ?? "-"}</td>
                    <td className="px-4 py-3 font-medium text-[var(--primary)]">{Number(r.point_amount).toLocaleString()}P</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <aside className="w-[380px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">상세</h3>
          <p className="mt-1 text-sm text-[var(--primary)]">{selected.reward_catalog?.title} · {Number(selected.point_amount).toLocaleString()}P</p>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-[var(--text-muted)]">배송 정보</p>
              <p className="mt-0.5 text-[var(--text-primary)]">
                {selected.shipping_name} / {selected.shipping_phone}
                <br />
                {selected.shipping_address1}
                {selected.shipping_address2 ? ` ${selected.shipping_address2}` : ""}
                {selected.shipping_zip ? ` (${selected.shipping_zip})` : ""}
              </p>
            </div>
            {selected.user_message && (
              <div>
                <p className="font-medium text-[var(--text-muted)]">요청 메모</p>
                <p className="mt-0.5 text-[var(--text-primary)]">{selected.user_message}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
            >
              {copiedContact ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedContact ? "복사됨" : "연락처 복사"}
            </button>
            {MESSAGE_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => copyTemplate(buildTemplateBody(t.key))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
              >
                {copiedTemplate ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-[var(--text-muted)]">내부 메모 (admin_memo)</label>
            <textarea
              value={adminMemo}
              onChange={(e) => setAdminMemo(e.target.value)}
              placeholder="관리자만 보는 메모"
              className="input-base mt-1 w-full resize-none bg-[var(--surface-muted)]"
              rows={2}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {selected.status === "REQUESTED" && (
              <>
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => runAction("approve", selected.id, { admin_memo: adminMemo || undefined })}
                  className="btn-admin-primary inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  승인
                </button>
                <div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="반려 사유 (사용자 알림에 포함)"
                    className="input-base w-full bg-[var(--surface-muted)] text-sm"
                  />
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      runAction("reject", selected.id, {
                        admin_memo: adminMemo || undefined,
                        reason: rejectReason || undefined,
                      })
                    }
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-[var(--danger)] hover:opacity-90"
                  >
                    <XCircle className="h-4 w-4" />
                    반려
                  </button>
                </div>
              </>
            )}
            {(selected.status === "REQUESTED" || selected.status === "APPROVED") && (
              <>
                <input
                  type="text"
                  value={trackingCarrier}
                  onChange={(e) => setTrackingCarrier(e.target.value)}
                  placeholder="택배사"
                  className="input-base bg-[var(--surface-muted)] text-sm"
                />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="운송장 번호"
                  className="input-base bg-[var(--surface-muted)] text-sm"
                />
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() =>
                    runAction("ship", selected.id, {
                      tracking_carrier: trackingCarrier || undefined,
                      tracking_number: trackingNumber || undefined,
                      admin_memo: adminMemo || undefined,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Truck className="h-4 w-4" />
                  발송
                </button>
              </>
            )}
            {(selected.status === "SHIPPED" || selected.status === "APPROVED") && (
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => runAction("complete", selected.id, { admin_memo: adminMemo || undefined })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
              >
                <CheckCircle className="h-4 w-4" />
                완료
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

```

## FILE: src/components/admin/points/EarnRequestDetail.tsx

```ts
"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";

const TEMPLATE_CONFIRM = `안녕하세요.
더올투어 포인트 적립 요청 관련 안내드립니다.

제출해주신 예약 정보를 확인 중이며
추가 확인이 필요한 부분이 있어 연락드립니다.

아래 정보를 확인 후 회신 부탁드립니다.

* 예약번호
* 출발일
* 결제자명

증빙 자료가 추가로 필요할 수 있습니다.

확인되는 대로 포인트 적립 여부를 안내드리겠습니다.

감사합니다.

더올투어 드림`;

type Detail = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
  attachments: Array<{ id: string; file_url: string; file_name: string }>;
};

type Props = {
  detail: Detail | null;
  onReload: () => Promise<void> | void;
};

export default function EarnRequestDetail({ detail, onReload }: Props) {
  const [amount, setAmount] = useState("10000");
  const [grantStatus, setGrantStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [adminMemo, setAdminMemo] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const messageTemplates = useMemo(() => {
    const amountNum = Number(amount) || 0;
    return [
      { label: "확인 요청 메시지", text: TEMPLATE_CONFIRM },
      {
        label: "승인 안내 메시지",
        text:
          grantStatus === "CONFIRMED"
            ? `안녕하세요.
더올투어입니다.

회원님께서 요청하신 여행 예약 건이 확인되어
포인트가 정상 지급되었습니다.

지급 포인트
+${amountNum}P

마이페이지에서 확인하실 수 있습니다.

앞으로도 더올투어 이용 부탁드립니다.

감사합니다.`
            : `안녕하세요.
더올투어입니다.

회원님께서 요청하신 예약 건이 확인되어
포인트 지급이 등록되었습니다.

현재 포인트는 검수 단계로
확정 후 사용 가능 상태로 전환됩니다.

지급 예정 포인트
+${amountNum}P

확정 시 다시 안내드리겠습니다.

감사합니다.`,
      },
      {
        label: "반려 안내 메시지",
        text: `안녕하세요.
더올투어입니다.

회원님께서 요청하신 포인트 적립 요청에 대해
검수 결과 아래 사유로 처리가 어려운 점 안내드립니다.

반려 사유
${rejectReason || "{reject_reason}"}

추가 문의가 있으시면 언제든지 문의 부탁드립니다.

감사합니다.

더올투어 드림`,
      },
    ];
  }, [amount, grantStatus, rejectReason]);

  if (!detail) {
    return <p className="text-sm text-[var(--text-muted)]">요청을 선택하면 상세 정보가 표시됩니다.</p>;
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setMessage({ type: "ok", text: "메시지를 복사했습니다." });
  };

  const copyContact = async () => {
    const text = [detail.payer_name, detail.contact_phone, detail.members?.phone].filter(Boolean).join(" / ");
    await navigator.clipboard.writeText(text);
    setMessage({ type: "ok", text: "연락처를 복사했습니다." });
  };

  const approve = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/points/earn-requests/${detail.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          grant_status: grantStatus,
          admin_memo: adminMemo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "승인 처리 실패" });
        return;
      }
      setMessage({ type: "ok", text: data.message || "승인 완료" });
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/points/earn-requests/${detail.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reject_reason: rejectReason,
          admin_memo: adminMemo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "반려 처리 실패" });
        return;
      }
      setMessage({ type: "ok", text: data.message || "반려 완료" });
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">요청 상세</h3>
      <p className="text-sm text-[var(--text-secondary)]">예약번호: {detail.booking_ref}</p>
      <p className="text-sm text-[var(--text-secondary)]">출발일: {detail.departure_date}</p>
      <p className="text-sm text-[var(--text-secondary)]">결제자명: {detail.payer_name}</p>
      <p className="text-sm text-[var(--text-secondary)]">연락처: {detail.contact_phone ?? detail.members?.phone ?? "-"}</p>
      <p className="text-sm text-[var(--text-secondary)]">요청 메모: {detail.memo ?? "-"}</p>
      <button
        type="button"
        onClick={copyContact}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)]"
      >
        <Copy className="h-3.5 w-3.5" />
        연락처 복사
      </button>

      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--text-muted)]">증빙 파일</p>
        {detail.attachments.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">첨부 파일 없음</p>
        ) : (
          detail.attachments.map((file) => (
            <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="block text-xs text-[var(--primary)] underline">
              {file.file_name}
            </a>
          ))
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">승인</p>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="amount"
          className="input-base w-full bg-[var(--surface-muted)]"
        />
        <select
          value={grantStatus}
          onChange={(e) => setGrantStatus(e.target.value as "CONFIRMED" | "PENDING")}
          className="input-base w-full bg-[var(--surface-muted)]"
        >
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PENDING">PENDING</option>
        </select>
        <textarea
          value={adminMemo}
          onChange={(e) => setAdminMemo(e.target.value)}
          placeholder="admin_memo"
          rows={2}
          className="input-base w-full resize-none bg-[var(--surface-muted)]"
        />
        <button
          type="button"
          disabled={loading || detail.status !== "REQUESTED"}
          onClick={approve}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          승인
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">반려</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="reject_reason"
          rows={2}
          className="input-base w-full resize-none bg-[var(--surface-muted)]"
        />
        <button
          type="button"
          disabled={loading || detail.status !== "REQUESTED" || !rejectReason.trim()}
          onClick={reject}
          className="rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
        >
          반려
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">메시지 템플릿 복사</p>
        {messageTemplates.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => copy(item.text)}
            className="block w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-left text-xs text-[var(--text-primary)]"
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className={message.type === "ok" ? "text-xs text-[var(--success)]" : "text-xs text-[var(--danger)]"}>
          {message.text}
        </p>
      ) : null}
    </aside>
  );
}

```

## FILE: src/components/admin/points/EarnRequestRequestsManager.tsx

```ts
"use client";

import { useEffect, useState } from "react";
import EarnRequestTabs from "@/components/admin/points/EarnRequestTabs";
import EarnRequestDetail from "@/components/admin/points/EarnRequestDetail";
import EarnRequestCsvModal from "@/components/admin/points/EarnRequestCsvModal";

type Status = "REQUESTED" | "APPROVED" | "REJECTED";

type ListRow = {
  id: string;
  status: Status;
  booking_ref: string;
  departure_date: string;
  requested_at: string;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
};

type Detail = {
  id: string;
  status: Status;
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
  attachments: Array<{ id: string; file_url: string; file_name: string }>;
};

export default function EarnRequestRequestsManager() {
  const [status, setStatus] = useState<Status>("REQUESTED");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/points/earn-requests?status=${status}`, { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ListRow[]) : [];
      setRows(list);
      if (selectedId && !list.some((r) => r.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    const res = await fetch(`/api/admin/points/earn-requests/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setDetail(data as Detail);
      setSelectedId(id);
    }
  };

  useEffect(() => {
    loadRows();
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EarnRequestTabs value={status} onChange={setStatus} />
        <EarnRequestCsvModal onApplied={loadRows} />
      </div>

      <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1fr,360px] lg:gap-4">
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {loading ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">불러오는 중...</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">해당 상태 요청이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    <th className="px-3 py-2">예약번호</th>
                    <th className="px-3 py-2">회원</th>
                    <th className="px-3 py-2">출발일</th>
                    <th className="px-3 py-2">요청일</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => loadDetail(row.id)}
                      className={`cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)] ${
                        selectedId === row.id ? "bg-[var(--primary-soft)]" : ""
                      }`}
                    >
                      <td className="px-3 py-2">{row.booking_ref}</td>
                      <td className="px-3 py-2">{row.members?.name ?? "-"}</td>
                      <td className="px-3 py-2">{row.departure_date}</td>
                      <td className="px-3 py-2">{new Date(row.requested_at).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <EarnRequestDetail detail={detail} onReload={async () => {
          await loadRows();
          if (selectedId) await loadDetail(selectedId);
        }} />
      </div>
    </div>
  );
}

```

## FILE: src/components/admin/points/EarnRequestCsvModal.tsx

```ts
"use client";

import { useState } from "react";

type Props = {
  onApplied: () => Promise<void> | void;
};

export default function EarnRequestCsvModal({ onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("booking_ref,amount,grant_status,admin_memo\n");
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const preview = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/points/earn-requests/csv-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "미리보기에 실패했습니다.");
        return;
      }
      setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/points/earn-requests/csv-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "일괄 적용 실패");
        return;
      }
      setMessage(`적용 완료: 성공 ${data.successCount} / 실패 ${data.failCount}`);
      await onApplied();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
      >
        CSV 반자동 지급
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">CSV 반자동 지급</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">헤더: booking_ref,amount,grant_status,admin_memo</p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className="input-base mt-3 w-full resize-none bg-[var(--surface-muted)]"
            />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={preview} disabled={loading} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                preview
              </button>
              <button type="button" onClick={apply} disabled={loading} className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--on-primary)]">
                apply
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                닫기
              </button>
            </div>
            {message ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}
            {previewRows.length > 0 ? (
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-[var(--border)] p-2">
                {previewRows.map((row, idx) => (
                  <pre key={idx} className="text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(row)}
                  </pre>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

```

## FILE: src/components/admin/points/EarnRequestTabs.tsx

```ts
"use client";

type Status = "REQUESTED" | "APPROVED" | "REJECTED";

type Props = {
  value: Status;
  onChange: (next: Status) => void;
};

const TABS: Array<{ id: Status; label: string }> = [
  { id: "REQUESTED", label: "REQUESTED" },
  { id: "APPROVED", label: "APPROVED" },
  { id: "REJECTED", label: "REJECTED" },
];

export default function EarnRequestTabs({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              active
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

```

## FILE: src/app/admin/points/page.tsx

```ts
import AdminHeader from "@/components/admin/AdminHeader";
import AdminPointsGrantManager from "@/components/admin/AdminPointsGrantManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminPointsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="points"
          title="포인트 지급 관리"
          description="회원 검색 후 포인트를 지급하고, 지급 내역을 확인할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <div className="flex justify-end">
          <a
            href="/admin/points/requests"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            적립 요청 관리로 이동
          </a>
        </div>

        <AdminPointsGrantManager />
      </main>
    </div>
  );
}

```

## FILE: src/app/admin/points/requests/page.tsx

```ts
import AdminHeader from "@/components/admin/AdminHeader";
import EarnRequestRequestsManager from "@/components/admin/points/EarnRequestRequestsManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminPointRequestsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="points"
          title="포인트 적립 요청 관리"
          description="예약 증빙 기반 적립 요청을 검수하고 승인/반려 처리합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <EarnRequestRequestsManager />
      </main>
    </div>
  );
}

```

## FILE: src/app/admin/rewards/page.tsx

```ts
import { Suspense } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminRewardsManager from "@/components/admin/AdminRewardsManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminRewardsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="rewards"
          title="리워드 교환 관리"
          description="교환 신청을 상태별로 보고 승인/반려/발송/완료 처리할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <Suspense fallback={<div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">불러오는 중…</div>}>
          <AdminRewardsManager />
        </Suspense>
      </main>
    </div>
  );
}

```

## FILE: src/app/admin/rewards/redemptions/page.tsx

```ts
export { default } from "@/app/admin/rewards/page";

```

## FILE: src/app/theall_manager_only/points/page.tsx

```ts
export { default } from "@/app/admin/points/page";

```

## FILE: src/app/theall_manager_only/points/requests/page.tsx

```ts
export { default } from "@/app/admin/points/requests/page";

```

## FILE: src/app/theall_manager_only/rewards/page.tsx

```ts
export { default } from "@/app/admin/rewards/page";

```

## FILE: src/app/theall_manager_only/rewards/redemptions/page.tsx

```ts
export { default } from "@/app/admin/rewards/page";

```

## FILE: src/app/api/admin/points/grant/route.ts

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { grantPointsToUser } from "@/server/services/points/grantPoints";

type Body = {
  userId: string;
  amount: number;
  reason: string;
  refType?: string;
  refId?: string;
  expiresAt?: string;
  status?: "CONFIRMED" | "PENDING";
};

/** 관리자: 포인트 수동 지급 — ledger EARN, balance 또는 pending 반영, 알림 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const amount = Number(body.amount);
  const reason = body.reason?.trim() || "관리자 지급";
  const status = body.status === "PENDING" ? "PENDING" : "CONFIRMED";

  if (!userId) {
    return NextResponse.json({ message: "userId는 필수입니다." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상의 숫자여야 합니다." }, { status: 400 });
  }

  try {
    const result = await grantPointsToUser({
      userId,
      amount,
      status,
      reason,
      refType: body.refType?.trim() || undefined,
      refId: body.refId?.trim() || undefined,
      expiresAt: body.expiresAt?.trim() || null,
      actorAdminId: "ADMIN",
    });

    return NextResponse.json({
      message: status === "CONFIRMED" ? `${amount}P 지급되었습니다.` : `${amount}P가 대기 상태로 기록되었습니다.`,
      ledgerId: result.ledgerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포인트 지급에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

```

## FILE: src/app/api/admin/points/confirm/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

type Body = { ledgerId: string };

/** 관리자: pending EARN을 CONFIRMED로 전환 — point_balance 증가, point_pending 감소 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const ledgerId = body.ledgerId?.trim();
  if (!ledgerId) {
    return NextResponse.json({ message: "ledgerId는 필수입니다." }, { status: 400 });
  }

  const { data: ledger, error: fetchErr } = await supabase
    .from("point_ledger")
    .select("id, user_id, type, status, amount")
    .eq("id", ledgerId)
    .maybeSingle();

  if (fetchErr || !ledger) {
    return NextResponse.json({ message: "해당 원장 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = ledger as { type: string; status: string; user_id: string; amount: number };
  if (row.type !== "EARN" || row.status !== "PENDING") {
    return NextResponse.json({ message: "확정할 수 있는 대기 적립 기록이 아닙니다." }, { status: 400 });
  }

  const userId = row.user_id;
  const amount = Number(row.amount);

  const { error: ledgerUpdateErr } = await supabase
    .from("point_ledger")
    .update({ status: "CONFIRMED" })
    .eq("id", ledgerId);

  if (ledgerUpdateErr) {
    return NextResponse.json({ message: "원장 상태 변경에 실패했습니다." }, { status: 500 });
  }

  const { data: memberRow } = await supabase
    .from("members")
    .select("point_balance, point_pending")
    .eq("id", userId)
    .maybeSingle();

  if (!memberRow) {
    return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 500 });
  }

  const balance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
  const pending = Number((memberRow as { point_pending?: number }).point_pending ?? 0);
  if (pending < amount) {
    return NextResponse.json({ message: "대기 포인트가 부족합니다. 데이터를 확인해 주세요." }, { status: 400 });
  }

  const { error: memberUpdateErr } = await supabase
    .from("members")
    .update({
      point_balance: balance + amount,
      point_pending: pending - amount,
    })
    .eq("id", userId);

  if (memberUpdateErr) {
    return NextResponse.json({ message: "포인트 확정 반영에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: "포인트 확정",
    body: `${amount}P가 확정되어 잔액에 반영되었습니다.`,
  });

  return NextResponse.json({ message: "포인트가 확정되었습니다." });
}

```

## FILE: src/app/api/admin/points/earn-requests/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  let query = supabase
    .from("point_earn_requests")
    .select(`
      id,
      user_id,
      status,
      booking_ref,
      departure_date,
      payer_name,
      memo,
      contact_phone,
      admin_memo,
      reject_reason,
      requested_at,
      decided_at,
      members ( id, name, username, email, phone )
    `)
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "요청 목록을 불러오지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

```

## FILE: src/app/api/admin/points/earn-requests/[id]/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  const { data: row, error } = await supabase
    .from("point_earn_requests")
    .select(`
      id,
      user_id,
      status,
      booking_ref,
      departure_date,
      payer_name,
      memo,
      contact_phone,
      admin_memo,
      reject_reason,
      requested_at,
      decided_at,
      members ( id, name, username, email, phone )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: attachments } = await supabase
    .from("earn_request_attachments")
    .select("id, file_url, file_name, mime_type, file_size, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ...(row as Record<string, unknown>),
    attachments: attachments ?? [],
  });
}

```

## FILE: src/app/api/admin/points/earn-requests/[id]/approve/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";
import { grantPointsToUser } from "@/server/services/points/grantPoints";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

type Body = {
  amount: number;
  grant_status: "CONFIRMED" | "PENDING";
  admin_memo?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const grantStatus = body.grant_status === "PENDING" ? "PENDING" : "CONFIRMED";
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상의 숫자여야 합니다." }, { status: 400 });
  }

  const { data: earnReq, error: reqErr } = await supabase
    .from("point_earn_requests")
    .select("id, user_id, booking_ref, status")
    .eq("id", id)
    .maybeSingle();

  if (reqErr || !earnReq) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = earnReq as { id: string; user_id: string; booking_ref: string; status: string };
  if (row.status !== "REQUESTED") {
    return NextResponse.json({ message: "요청 상태가 REQUESTED가 아닙니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("point_earn_requests")
    .update({
      status: "APPROVED",
      admin_memo: body.admin_memo?.trim() || null,
      decided_at: now,
      decided_by_admin_id: "ADMIN",
    })
    .eq("id", id)
    .eq("status", "REQUESTED");

  if (updateErr) {
    return NextResponse.json({ message: "요청 승인 상태 반영에 실패했습니다." }, { status: 500 });
  }

  try {
    await grantPointsToUser({
      userId: row.user_id,
      amount,
      status: grantStatus,
      reason: `예약 적립 요청 승인 (${row.booking_ref})`,
      refType: "EARN_REQUEST",
      refId: row.id,
      actorAdminId: "ADMIN",
    });

    const bodyText =
      grantStatus === "CONFIRMED"
        ? EARN_REQUEST_MESSAGE_TEMPLATES.approved(amount)
        : EARN_REQUEST_MESSAGE_TEMPLATES.pending(amount);
    await supabase.from("notifications").insert({
      user_id: row.user_id,
      type: "ADMIN_MESSAGE",
      title: "예약 적립 요청 승인",
      body: bodyText,
    });

    return NextResponse.json({ message: "요청을 승인하고 포인트를 지급했습니다." });
  } catch (error) {
    await supabase
      .from("point_earn_requests")
      .update({
        status: "REQUESTED",
        admin_memo: null,
        decided_at: null,
        decided_by_admin_id: null,
      })
      .eq("id", id);

    const message = error instanceof Error ? error.message : "승인 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

```

## FILE: src/app/api/admin/points/earn-requests/[id]/reject/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

type Body = {
  reject_reason: string;
  admin_memo?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rejectReason = body.reject_reason?.trim();
  if (!rejectReason) {
    return NextResponse.json({ message: "reject_reason은 필수입니다." }, { status: 400 });
  }

  const { data: earnReq, error: reqErr } = await supabase
    .from("point_earn_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (reqErr || !earnReq) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  if ((earnReq as { status: string }).status !== "REQUESTED") {
    return NextResponse.json({ message: "요청 상태가 REQUESTED가 아닙니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("point_earn_requests")
    .update({
      status: "REJECTED",
      reject_reason: rejectReason,
      admin_memo: body.admin_memo?.trim() || null,
      decided_at: now,
      decided_by_admin_id: "ADMIN",
    })
    .eq("id", id)
    .eq("status", "REQUESTED");

  if (updateErr) {
    return NextResponse.json({ message: "반려 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (earnReq as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "ADMIN_MESSAGE",
    title: "예약 적립 요청 반려",
    body: EARN_REQUEST_MESSAGE_TEMPLATES.rejected(rejectReason),
  });

  return NextResponse.json({ message: "요청이 반려 처리되었습니다." });
}

```

## FILE: src/app/api/admin/points/earn-requests/csv-preview/route.ts

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { parseSimpleCsvRows } from "@/server/services/points/earnRequests";

type Body = { csvText?: string };

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const csvText = body.csvText?.trim() ?? "";
  if (!csvText) {
    return NextResponse.json({ message: "csvText가 필요합니다." }, { status: 400 });
  }

  try {
    const rows = parseSimpleCsvRows(csvText);
    const bookingRefs = rows.map((r) => r.booking_ref).filter(Boolean);
    const { data: reqs } = await supabase
      .from("point_earn_requests")
      .select("id, booking_ref, status")
      .in("booking_ref", bookingRefs);

    const map = new Map((reqs ?? []).map((r: { id: string; booking_ref: string; status: string }) => [r.booking_ref, r]));
    const preview = rows.map((row) => {
      const matched = map.get(row.booking_ref);
      const validStatus = row.grant_status === "CONFIRMED" || row.grant_status === "PENDING";
      const validAmount = Number.isFinite(row.amount) && row.amount > 0;
      const canApply = Boolean(matched && matched.status === "REQUESTED" && validStatus && validAmount);
      return {
        ...row,
        requestId: matched?.id ?? null,
        requestStatus: matched?.status ?? null,
        canApply,
        reason: !matched
          ? "요청 없음"
          : matched.status !== "REQUESTED"
            ? `요청 상태 ${matched.status}`
            : !validStatus
              ? "grant_status 값 오류"
              : !validAmount
                ? "amount 값 오류"
                : "OK",
      };
    });

    return NextResponse.json({ rows: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV 파싱 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

```

## FILE: src/app/api/admin/points/earn-requests/csv-apply/route.ts

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { grantPointsToUser } from "@/server/services/points/grantPoints";
import { EARN_REQUEST_MESSAGE_TEMPLATES, parseSimpleCsvRows } from "@/server/services/points/earnRequests";

type Body = { csvText?: string };

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const csvText = body.csvText?.trim() ?? "";
  if (!csvText) {
    return NextResponse.json({ message: "csvText가 필요합니다." }, { status: 400 });
  }

  let rows: ReturnType<typeof parseSimpleCsvRows>;
  try {
    rows = parseSimpleCsvRows(csvText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV 파싱 실패";
    return NextResponse.json({ message }, { status: 400 });
  }

  const results: Array<{ rowNo: number; booking_ref: string; success: boolean; message: string }> = [];

  for (const row of rows) {
    try {
      if (!(row.grant_status === "CONFIRMED" || row.grant_status === "PENDING")) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "grant_status 오류" });
        continue;
      }
      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "amount 오류" });
        continue;
      }

      const { data: earnReq, error: reqErr } = await supabase
        .from("point_earn_requests")
        .select("id, user_id, status, booking_ref")
        .eq("booking_ref", row.booking_ref)
        .maybeSingle();

      if (reqErr || !earnReq) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "요청 없음" });
        continue;
      }
      const req = earnReq as { id: string; user_id: string; status: string; booking_ref: string };
      if (req.status !== "REQUESTED") {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: `요청 상태 ${req.status}` });
        continue;
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("point_earn_requests")
        .update({
          status: "APPROVED",
          admin_memo: row.admin_memo || null,
          decided_at: now,
          decided_by_admin_id: "ADMIN",
        })
        .eq("id", req.id)
        .eq("status", "REQUESTED");

      if (updateErr) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "상태 변경 실패" });
        continue;
      }

      try {
        await grantPointsToUser({
          userId: req.user_id,
          amount: row.amount,
          status: row.grant_status as "CONFIRMED" | "PENDING",
          reason: `CSV 적립 요청 승인 (${req.booking_ref})`,
          refType: "EARN_REQUEST",
          refId: req.id,
          actorAdminId: "ADMIN",
        });

        await supabase.from("notifications").insert({
          user_id: req.user_id,
          type: "ADMIN_MESSAGE",
          title: "예약 적립 요청 승인",
          body:
            row.grant_status === "CONFIRMED"
              ? EARN_REQUEST_MESSAGE_TEMPLATES.approved(row.amount)
              : EARN_REQUEST_MESSAGE_TEMPLATES.pending(row.amount),
        });

        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: true, message: "적용 완료" });
      } catch (error) {
        await supabase
          .from("point_earn_requests")
          .update({
            status: "REQUESTED",
            admin_memo: null,
            decided_at: null,
            decided_by_admin_id: null,
          })
          .eq("id", req.id);

        const msg = error instanceof Error ? error.message : "포인트 지급 실패";
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: msg });
      }
    } catch {
      results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "처리 중 오류" });
    }
  }

  return NextResponse.json({
    total: rows.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
    results,
  });
}

```

## FILE: src/app/api/admin/rewards/redemptions/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 교환 신청 목록 (query status=REQUESTED 등) */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || undefined;

  let query = supabase
    .from("reward_redemptions")
    .select(`
      *,
      reward_catalog ( id, title, point_cost, stock ),
      members ( id, name, username, email, phone )
    `)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

```

## FILE: src/app/api/admin/rewards/redemptions/[id]/approve/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 승인 — 재고 감소(stock not null 시), status=APPROVED, 알림 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string };
  try {
    body = (await request.json()) as { admin_memo?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, catalog_id, point_amount, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; catalog_id: string };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const catalogId = r.catalog_id;
  const { data: catalog } = await supabase
    .from("reward_catalog")
    .select("stock")
    .eq("id", catalogId)
    .maybeSingle();

  if (catalog != null) {
    const current = (catalog as { stock: number | null }).stock;
    if (current != null) {
      if (current <= 0) {
        return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
      }
      await supabase
        .from("reward_catalog")
        .update({ stock: current - 1, updated_at: new Date().toISOString() })
        .eq("id", catalogId);
    }
  }

  const { error: updateErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "승인 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (row as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 승인",
    body: "경품 교환이 승인되었습니다. 발송 예정입니다.",
  });

  return NextResponse.json({ message: "승인되었습니다." });
}

```

## FILE: src/app/api/admin/rewards/redemptions/[id]/reject/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 반려 — RELEASE ledger + balance 복구, status=REJECTED, 알림 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string; reason?: string };
  try {
    body = (await request.json()) as { admin_memo?: string; reason?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, point_amount, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string; point_amount: number };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const userId = r.user_id;
  const amount = Number(r.point_amount);

  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RELEASE",
    status: "CONFIRMED",
    amount,
    reason: "경품 교환 반려로 인한 포인트 복구",
    ref_type: "REWARD_REDEMPTION",
    ref_id: id,
  });

  if (ledgerErr) {
    return NextResponse.json({ message: "포인트 복구 기록에 실패했습니다." }, { status: 500 });
  }

  const { data: memberRow } = await supabase
    .from("members")
    .select("point_balance")
    .eq("id", userId)
    .maybeSingle();
  const currentBalance = Number((memberRow as { point_balance?: number } | null)?.point_balance ?? 0);
  const { error: updateMemberErr } = await supabase
    .from("members")
    .update({ point_balance: currentBalance + amount })
    .eq("id", userId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "포인트 복구에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "REJECTED",
      decided_at: new Date().toISOString(),
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "반려 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const reasonText = body.reason?.trim() || body.admin_memo?.trim() || "";
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 반려",
    body: reasonText ? `경품 교환이 반려되었습니다. 사유: ${reasonText}` : "경품 교환이 반려되었습니다.",
  });

  return NextResponse.json({ message: "반려 처리되었습니다. 포인트가 복구되었습니다." });
}

```

## FILE: src/app/api/admin/rewards/redemptions/[id]/ship/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 발송 처리 — tracking 저장, status=SHIPPED, 알림(운송장 포함) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { tracking_carrier?: string; tracking_number?: string; admin_memo?: string };
  try {
    body = (await request.json()) as { tracking_carrier?: string; tracking_number?: string; admin_memo?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string };
  if (r.status !== "APPROVED" && r.status !== "REQUESTED") {
    return NextResponse.json({ message: "승인된 신청만 발송 처리할 수 있습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "SHIPPED",
      shipped_at: now,
      tracking_carrier: body.tracking_carrier?.trim() || null,
      tracking_number: body.tracking_number?.trim() || null,
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: now,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "발송 처리에 실패했습니다." }, { status: 500 });
  }

  const carrier = body.tracking_carrier?.trim() || "";
  const number = body.tracking_number?.trim() || "";
  const trackingText = carrier && number ? ` (${carrier}: ${number})` : number ? ` (${number})` : "";
  await supabase.from("notifications").insert({
    user_id: r.user_id,
    type: "REWARD_STATUS",
    title: "발송 완료",
    body: `경품이 발송되었습니다.${trackingText}`,
  });

  return NextResponse.json({ message: "발송 처리되었습니다." });
}

```

## FILE: src/app/api/admin/rewards/redemptions/[id]/complete/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 완료 처리 — status=COMPLETED */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string };
  try {
    body = (await request.json()) as { admin_memo?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, status, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string };
  if (r.status !== "SHIPPED" && r.status !== "APPROVED") {
    return NextResponse.json({ message: "발송된 신청만 완료 처리할 수 있습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "COMPLETED",
      completed_at: now,
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: now,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "완료 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (row as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "수령 완료",
    body: "경품 수령이 완료 처리되었습니다.",
  });

  return NextResponse.json({ message: "완료 처리되었습니다." });
}

```

## FILE: src/app/api/admin/reward-catalog/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RewardCatalogRow } from "@/types/pointsRewardsV2";

/** 관리자: 경품 목록 (비활성 포함) */
export async function GET() {
  const { data, error } = await supabase
    .from("reward_catalog")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "경품 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as RewardCatalogRow[]);
}

type CatalogBody = {
  title?: string;
  description?: string;
  point_price?: number;
  image_url?: string | null;
  stock_count?: number;
  is_active?: boolean;
  sort_order?: number;
};

/** 관리자: 경품 추가 */
export async function POST(request: Request) {
  const body = (await request.json()) as CatalogBody;
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
  }
  const pointPrice = Number(body.point_price);
  if (!Number.isFinite(pointPrice) || pointPrice <= 0) {
    return NextResponse.json({ message: "포인트 가격은 1 이상의 숫자로 입력해 주세요." }, { status: 400 });
  }

  const row = {
    title,
    description: body.description?.trim() || null,
    point_price: pointPrice,
    image_url: body.image_url?.trim() || null,
    stock_count: Math.max(0, Math.floor(Number(body.stock_count) || 0)),
    is_active: body.is_active !== false,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("reward_catalog").insert(row).select("id,title,point_price").maybeSingle();
  if (error) {
    return NextResponse.json({ message: "경품 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "등록되었습니다.", id: (data as { id: string })?.id }, { status: 201 });
}

```

## FILE: src/app/api/admin/reward-redemptions/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 경품 교환 신청 목록 (status 필터 가능) — reward_redemptions 기준 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("reward_redemptions")
    .select(`
      id,
      user_id,
      catalog_id,
      status,
      point_amount,
      requested_at,
      decided_at,
      shipped_at,
      completed_at,
      admin_memo,
      user_message,
      shipping_name,
      shipping_phone,
      shipping_address1,
      shipping_address2,
      shipping_zip,
      tracking_carrier,
      tracking_number,
      created_at,
      updated_at,
      reward_catalog(id, title, point_cost, image_url),
      members(id, name, username, email, phone)
    `)
    .order("created_at", { ascending: false });

  if (status?.trim()) {
    query = query.eq("status", status.trim().toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "교환 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  type Catalog = { id: string; title: string; point_cost: number; image_url: string | null };
  type Member = { id: string; name: string; username: string; email: string; phone: string };
  type RawRow = Record<string, unknown> & {
    reward_catalog?: Catalog | Catalog[] | null;
    members?: Member | Member[] | null;
  };

  const rows = (data ?? []) as RawRow[];
  const list = rows.map((r) => {
    const catalog = Array.isArray(r.reward_catalog) ? r.reward_catalog[0] : r.reward_catalog;
    const member = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      ...r,
      reward_catalog_id: r.catalog_id,
      member_id: r.user_id,
      reward_catalog: catalog
        ? { ...catalog, point_price: (catalog as Catalog).point_cost }
        : null,
      members: member ?? null,
    };
  });

  return NextResponse.json(list);
}

```

## FILE: src/app/api/admin/reward-redemptions/[id]/approve/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 교환 승인 — reward_redemptions 기준, point_ledger USE(양수) + 잔액 차감 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: redemptionId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { admin_memo?: string; admin_note?: string };
  const adminMemo = body.admin_memo?.trim() ?? body.admin_note?.trim() ?? null;

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, catalog_id, point_amount, status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string; point_amount: number; catalog_id: string };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const userId = r.user_id;
  const pointAmount = Number(r.point_amount);
  const catalogId = r.catalog_id;

  const { data: memberRow } = await supabase
    .from("members")
    .select("point_balance, points")
    .eq("id", userId)
    .maybeSingle();

  const member = memberRow as { point_balance?: number; points?: number } | null;
  const currentPoints = Number(member?.point_balance ?? member?.points ?? 0);
  if (currentPoints < pointAmount) {
    return NextResponse.json(
      { message: `회원 보유 포인트가 부족합니다. (필요: ${pointAmount}, 보유: ${currentPoints})` },
      { status: 400 },
    );
  }

  const newBalance = currentPoints - pointAmount;

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: userId,
      type: "USE",
      status: "CONFIRMED",
      amount: pointAmount,
      reason: "경품 교환",
      ref_type: "REDEMPTION",
      ref_id: redemptionId,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  const updateMemberPayload: { point_balance?: number; points?: number } = {};
  if (member && "point_balance" in member && member.point_balance !== undefined) {
    updateMemberPayload.point_balance = newBalance;
  } else {
    updateMemberPayload.points = newBalance;
  }

  const { error: updateMemberErr } = await supabase
    .from("members")
    .update(updateMemberPayload)
    .eq("id", userId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "회원 포인트 차감에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      admin_memo: adminMemo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", redemptionId);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "교환 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const { data: catalog } = await supabase
    .from("reward_catalog")
    .select("stock, stock_count")
    .eq("id", catalogId)
    .maybeSingle();

  if (catalog != null) {
    const c = catalog as { stock?: number | null; stock_count?: number };
    const current = c.stock ?? c.stock_count;
    if (typeof current === "number" && current > 0) {
      const nextStock = current - 1;
      const payload: Record<string, string | number> = { updated_at: new Date().toISOString() };
      if (c.stock != null) payload.stock = nextStock;
      if (c.stock_count != null) payload.stock_count = nextStock;
      await supabase.from("reward_catalog").update(payload).eq("id", catalogId);
    }
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 승인",
    body: "경품 교환이 승인되었습니다. 포인트가 차감되었습니다.",
  });

  return NextResponse.json({ message: "승인되었습니다. 포인트가 차감되었습니다." });
}

```

## FILE: src/app/api/admin/reward-redemptions/[id]/reject/route.ts

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 교환 반려 — reward_redemptions 기준, RELEASE 원장 + 잔액 복구, status=REJECTED */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: redemptionId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { admin_memo?: string; admin_note?: string; reason?: string };
  const adminMemo = body.admin_memo?.trim() ?? body.admin_note?.trim() ?? null;

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, point_amount, status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string; point_amount: number };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const userId = r.user_id;
  const amount = Number(r.point_amount);

  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RELEASE",
    status: "CONFIRMED",
    amount,
    reason: "경품 교환 반려로 인한 포인트 복구",
    ref_type: "REDEMPTION",
    ref_id: redemptionId,
  });

  if (ledgerErr) {
    return NextResponse.json({ message: "포인트 복구 기록에 실패했습니다." }, { status: 500 });
  }

  const { data: memberRow } = await supabase
    .from("members")
    .select("point_balance, points")
    .eq("id", userId)
    .maybeSingle();

  const member = memberRow as { point_balance?: number; points?: number } | null;
  const currentBalance = Number(member?.point_balance ?? member?.points ?? 0);

  const updatePayload: { point_balance?: number; points?: number } = {};
  if (member && "point_balance" in member && member.point_balance !== undefined) {
    updatePayload.point_balance = currentBalance + amount;
  } else {
    updatePayload.points = currentBalance + amount;
  }

  const { error: updateMemberErr } = await supabase.from("members").update(updatePayload).eq("id", userId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "포인트 복구에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "REJECTED",
      decided_at: new Date().toISOString(),
      admin_memo: adminMemo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", redemptionId);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "반려 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const reasonText = body.reason?.trim() ?? adminMemo ?? "";
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 반려",
    body: reasonText ? `경품 교환이 반려되었습니다. 사유: ${reasonText}` : "경품 교환이 반려되었습니다. 포인트가 복구되었습니다.",
  });

  return NextResponse.json({ message: "거절되었습니다. 포인트가 복구되었습니다." });
}

```

## FILE: src/components/admin/SubHeader.tsx

```ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Moon, Search, Sun } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  PRODUCT_LABEL_TO_VIEW,
  PRODUCT_VIEW_TO_LABEL,
} from "@/components/admin/products/adminProducts.constants";
import { confirmAdminProductUnsavedIfNeeded } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";

export type SubHeaderTab = { label: string; href: string };

/** 후기 관리 상단 가로 탭 (본문 상단 탭 UI용) */
export const REVIEWS_TABS: SubHeaderTab[] = [
  { label: "리뷰 목록 (검색)", href: "/admin/reviews" },
  { label: "리뷰 검토", href: "/admin/reviews/moderation" },
  { label: "리뷰 운영 알림", href: "/admin/reviews/notifications" },
  { label: "후기 신고", href: "/theall_manager_only/review-reports" },
  { label: "후기 리마인더", href: "/theall_manager_only/review-reminders" },
  { label: "리뷰 요약", href: "/theall_manager_only/review-summaries" },
  { label: "리뷰 분석", href: "/admin/reviews/analytics" },
  { label: "리뷰 이상 감지", href: "/admin/reviews/anomalies" },
  { label: "리뷰 요약 (관리자)", href: "/admin/reviews/summaries" },
  { label: "리뷰 작성자 분석", href: "/admin/reviews/authors" },
  { label: "리뷰 A/B 실험", href: "/admin/reviews/experiments" },
  { label: "리뷰 전환 기여도", href: "/admin/reviews/conversions" },
  { label: "리뷰 인사이트", href: "/admin/reviews/insights" },
];

function isReviewTabActive(href: string, pathname: string): boolean {
  if (href === "/admin/reviews") return pathname === "/admin/reviews";
  if (href === "/theall_manager_only/reviews") return pathname === "/theall_manager_only/reviews";
  return pathname === href || pathname.startsWith(href + "/");
}

export const menuMap = {
  dashboard: ["운영 현황", "통계"],
  product: ["상품 목록", "상품 등록", "상품 등록(모두)", "카테고리/테마 관리", "메인 지역카드", "메인 테마카드", "메인 추천상품 관리"],
  inquiry: ["전체 문의", "미처리 문의"],
  member: ["회원 목록"],
  rewards: ["신청", "승인", "발송", "완료", "반려"],
  points: ["포인트 지급"],
  settings: [],
  reviews: [] as string[],
  guides: ["가이드 목록", "가이드등록(노션)", "가이드등록(일반)"],
  banners: ["배너 목록"],
  notices: ["회원가입 법률 문서", "공지 등록", "등록된 공지 목록"],
  notifications: ["알림 목록"],
} as const;

export type MainMenuKey = keyof typeof menuMap;

const MAIN_MENU_TITLE: Record<MainMenuKey, string> = {
  dashboard: "대시보드",
  product: "상품 관리",
  inquiry: "문의 관리",
  member: "회원 관리",
  rewards: "리워드 교환 관리",
  points: "포인트 지급 관리",
  settings: "환경설정",
  reviews: "후기 관리",
  guides: "여행가이드",
  banners: "메인배너",
  notices: "공지사항",
  notifications: "알림",
};

type SubHeaderProps = {
  activeMenu: MainMenuKey | null;
  onTabChange?: (label: string) => void;
};

export default function SubHeader({ activeMenu, onTabChange }: SubHeaderProps) {
  const items = useMemo(
    () => (activeMenu && activeMenu !== "reviews" ? menuMap[activeMenu] ?? [] : []) as string[],
    [activeMenu],
  );
  const hasReviewTabs = activeMenu === "reviews";
  const hasSubTabs = hasReviewTabs || items.length > 0;
  const [activeLabel, setActiveLabel] = useState<string | null>(items[0] ?? null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    let initial: string | null = items[0] ?? null;

    if (activeMenu === "product") {
      const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      if (pathname.includes("/products/new-modetour")) {
        initial = "상품 등록(모두)";
      } else if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
      } else if (view === ADMIN_PRODUCTS_VIEW.FEATURED) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.FEATURED];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.CREATE) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
      } else if (view === ADMIN_PRODUCTS_VIEW.LIST) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      } else {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      }
    }
    if (activeMenu === "notices") {
      const view = searchParams.get("view");
      if (view === "legal") {
        initial = "회원가입 법률 문서";
      } else if (view === "create") {
        initial = "공지 등록";
      } else if (view === "list") {
        initial = "등록된 공지 목록";
      } else {
        initial = "등록된 공지 목록";
      }
    }
    if (activeMenu === "guides") {
      const view = searchParams.get("view");
      if (view === "notion") {
        initial = "가이드등록(노션)";
      } else if (view === "general") {
        initial = "가이드등록(일반)";
      } else {
        initial = "가이드 목록";
      }
    }
    if (activeMenu === "rewards") {
      const status = searchParams.get("status");
      const tabByStatus: Record<string, string> = {
        REQUESTED: "신청",
        APPROVED: "승인",
        SHIPPED: "발송",
        COMPLETED: "완료",
        REJECTED: "반려",
      };
      initial = (status && tabByStatus[status]) || "신청";
    }

    setActiveLabel(initial);
    if (initial && onTabChange) {
      onTabChange(initial);
    }
  }, [items, onTabChange, activeMenu, searchParams]);

  useEffect(() => {
    function handleScroll() {
      if (typeof window === "undefined") return;
      setIsScrolled(window.scrollY > 0);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theall-admin-theme");
    /* 기본값: 라이트 모드. 저장된 값이 "dark"일 때만 다크 적용 */
    const shouldEnable = stored === "dark";
    const root = document.documentElement;
    if (shouldEnable) {
      root.classList.add("dark");
      setIsDarkMode(true);
    } else {
      root.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleTheme() {
    if (typeof window === "undefined") return;
    setIsDarkMode((prev) => {
      const next = !prev;
      const root = document.documentElement;
      if (next) {
        root.classList.add("dark");
        window.localStorage.setItem("theall-admin-theme", "dark");
      } else {
        root.classList.remove("dark");
        window.localStorage.setItem("theall-admin-theme", "light");
      }
      return next;
    });
  }

  function mapProductLabelToView(label: string): string | null {
    const view = PRODUCT_LABEL_TO_VIEW[label];
    return view ?? null;
  }

  function mapNoticesLabelToView(label: string): string | null {
    if (label === "회원가입 법률 문서") return "legal";
    if (label === "공지 등록") return "create";
    if (label === "등록된 공지 목록") return "list";
    return null;
  }

  function mapGuidesLabelToView(label: string): string | null {
    if (label === "가이드등록(노션)") return "notion";
    if (label === "가이드등록(일반)") return "general";
    if (label === "가이드 목록") return "list";
    return null;
  }

  const REWARDS_LABEL_TO_STATUS: Record<string, string> = {
    신청: "REQUESTED",
    승인: "APPROVED",
    발송: "SHIPPED",
    완료: "COMPLETED",
    반려: "REJECTED",
  };

  function handleTabClick(label: string) {
    if (!confirmAdminProductUnsavedIfNeeded()) return;

    setActiveLabel(label);
    onTabChange?.(label);

    if (activeMenu === "product") {
      if (label === "상품 등록(모두)") {
        router.push("/theall_manager_only/products/new-modetour");
        return;
      }
      const view = mapProductLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set(ADMIN_PRODUCTS_QUERY_KEYS.VIEW, view);
      } else {
        params.delete(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      }
      const query = params.toString();
      const basePath = pathname.includes("/products/new-modetour")
        ? "/theall_manager_only/products"
        : pathname;
      const target = query ? `${basePath}?${query}` : basePath;
      router.push(target);
      return;
    }
    if (activeMenu === "notices") {
      const view = mapNoticesLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set("view", view);
      } else {
        params.delete("view");
      }
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
    if (activeMenu === "guides") {
      const view = mapGuidesLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set("view", view);
      } else {
        params.delete("view");
      }
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
    if (activeMenu === "rewards") {
      const status = searchParams.get("status");
      const params = new URLSearchParams(searchParams.toString());
      if (status) {
        params.set("status", status);
      } else {
        params.delete("status");
      }
      params.delete("id");
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
  }

  if (!activeMenu) {
    return null;
  }

  const title = MAIN_MENU_TITLE[activeMenu];
  const showInlineTabs = !hasReviewTabs && items.length > 0;

  return (
    <div
      className={`sticky top-0 z-30 w-full border-b border-[var(--divider)] bg-[var(--card)] transition-shadow ${
        isScrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="flex h-14 items-center justify-between px-6 md:px-10">
        {/* 왼쪽: 제목 + 탭 (리뷰가 아닐 때만 인라인 탭) */}
        <div className="flex items-center gap-10">
          <h1 className="text-base font-semibold text-[var(--text)]">{title}</h1>

          {showInlineTabs ? (
          <div className="flex items-center gap-6 text-sm">
            {items.map((label) => {
              const isActive = activeLabel === label;
              return (
                <button
                  key={label}
                  onClick={() => handleTabClick(label)}
                  className={`relative pb-1 transition-colors duration-200 ${
                    isActive
                      ? "font-semibold text-[var(--brand)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[var(--brand)]"
                      : "text-[var(--text-muted)] hover:text-[var(--brand)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          ) : null}
        </div>

        {/* 오른쪽: 다크 토글 + 검색 + 글로벌 액션 + 알림/로그아웃 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--card)] sm:flex"
            aria-label={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {isDarkMode ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            <span>{isDarkMode ? "Dark" : "Light"}</span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              type="text"
              value={globalSearch}
              onChange={(event) => {
                const value = event.target.value;
                setGlobalSearch(value);
                // TODO: wire up admin global search API
              }}
              ref={searchInputRef}
              placeholder="Admin search..."
              className="w-[240px] rounded-md border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!confirmAdminProductUnsavedIfNeeded()) return;
              router.push(`/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.CREATE}`);
            }}
            className="btn-admin-primary"
          >
            + 상품 추가
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmAdminProductUnsavedIfNeeded()) return;
              router.push("/theall_manager_only/notifications");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] transition-colors duration-150 hover:bg-[var(--surface-muted)]"
            aria-label="알림 보기"
          >
            <Bell className="h-4 w-4" />
          </button>
          <AdminLogoutButton />
        </div>
      </div>

      {/* 후기 관리: 본문 상단 가로 탭 바 (가로 스크롤) */}
      {hasReviewTabs && (
        <div className="border-t border-[var(--divider)] bg-[var(--card)] px-6 py-3 md:px-10">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <div className="inline-flex min-w-max items-center gap-1">
              {REVIEWS_TABS.map((tab) => {
                const active = isReviewTabActive(tab.href, pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


```

## FILE: src/components/admin/Sidebar.tsx

```ts
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";
import { confirmAdminProductUnsavedIfNeeded } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";
import { ThemedWordmarkImage } from "@/components/header/ThemedWordmarkImage";

type SidebarProps = {
  activeMenu: MainMenuKey | null;
  setActiveMenu: (key: MainMenuKey) => void;
};

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAdminRole();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300`}
      style={{ width: isCollapsed ? "72px" : "256px" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 pt-6 pb-4">
          <Link href="/" className="inline-flex items-center">
            <ThemedWordmarkImage
              sizes="120px"
              imgClassName="h-auto w-[120px] max-w-full object-contain object-left"
            />
          </Link>
          <button
            type="button"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)] shadow-sm transition-colors duration-150 hover:bg-[var(--surface-muted)]"
          >
            {isCollapsed ? ">>" : "<<"}
          </button>
        </div>
        {!isCollapsed && (
          <p className="px-4 pb-4 text-xs font-semibold tracking-[0.18em] text-[var(--brand)]">
            THEALL TOUR ADMIN
          </p>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {SIDEBAR_ITEMS.filter((item) => item.section === "main" && item.roles.includes(role)).map(
            (item) => {
              const isActive = activeMenu === item.mainKey;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    if (!confirmAdminProductUnsavedIfNeeded()) return;
                    if (item.mainKey) setActiveMenu(item.mainKey);
                    router.push(item.href);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--surface-muted)] text-[var(--primary)] font-semibold"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  } ${isCollapsed ? "justify-center" : "justify-between"}`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className={isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
                      aria-hidden="true"
                    />
                    {!isCollapsed && <span>{item.label}</span>}
                  </span>
                </button>
              );
            },
          )}

          <div className="mt-4 space-y-1 border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-muted)]">
            {!isCollapsed && (
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em]">기타</p>
            )}
            {SIDEBAR_ITEMS.filter(
              (item) => item.section === "extra" && item.roles.includes(role),
            ).map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/theall_manager_only"
                  ? pathname === "/theall_manager_only"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--surface-muted)] text-[var(--primary)] font-semibold"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  } ${isCollapsed ? "justify-center" : "justify-between"}`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className={isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
                      aria-hidden="true"
                    />
                    {!isCollapsed && <span>{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}

```

## FILE: src/components/admin/sidebarConfig.tsx

```ts
import type { MainMenuKey } from "@/components/admin/SubHeader";
import type { AdminRole } from "@/types/adminRole";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Users,
  Settings,
  Star,
  BookOpen,
  Image as ImageIcon,
  Megaphone,
  Bell,
  Gift,
  Coins,
} from "lucide-react";

export type SidebarItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: "main" | "extra";
  mainKey?: MainMenuKey;
  roles: AdminRole[];
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    href: "/theall_manager_only",
    label: "대시보드",
    icon: LayoutDashboard,
    section: "main",
    mainKey: "dashboard",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/products",
    label: "상품 관리",
    icon: Package,
    section: "main",
    mainKey: "product",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/inquiries",
    label: "문의 관리",
    icon: MessageSquare,
    section: "main",
    mainKey: "inquiry",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/members",
    label: "회원 관리",
    icon: Users,
    section: "main",
    mainKey: "member",
    roles: ["admin"],
  },
  {
    href: "/theall_manager_only/rewards",
    label: "리워드 교환 관리",
    icon: Gift,
    section: "main",
    mainKey: "rewards",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/points",
    label: "포인트 지급 관리",
    icon: Coins,
    section: "main",
    mainKey: "points",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/settings",
    label: "환경설정",
    icon: Settings,
    section: "extra",
    roles: ["admin"],
  },
  {
    href: "/admin/reviews",
    label: "후기 관리",
    icon: Star,
    section: "extra",
    mainKey: "reviews",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/guides",
    label: "여행가이드",
    icon: BookOpen,
    section: "extra",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/banners",
    label: "메인배너",
    icon: ImageIcon,
    section: "extra",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/notices",
    label: "공지사항",
    icon: Megaphone,
    section: "extra",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/notifications",
    label: "알림",
    icon: Bell,
    section: "extra",
    roles: ["admin", "manager", "viewer"],
  },
];

```

## FILE: src/components/admin/AdminHeader.tsx

```ts
type AdminHeaderProps = {
  title: string;
  description: string;
  activeTab:
    | "dashboard"
    | "settings"
    | "products"
    | "inquiries"
    | "members"
    | "rewards"
    | "points"
    | "reviews"
    | "guides"
    | "notifications"
    | "banners"
    | "notices";
  productCount: number;
  inquiryCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export default function AdminHeader({
  title,
  description,
}: AdminHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">{title}</h1>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
    </header>
  );
}

```

## FILE: src/components/admin/common/HintDisclosure.tsx

```ts
"use client";

import { useState, useId, useEffect } from "react";

const STORAGE_PREFIX = "admin.hintDisclosure.";

export type HintDisclosureProps = {
  /** localStorage key suffix (key = admin.hintDisclosure.{id}) */
  id: string;
  /** 한 줄 요약 (항상 표시) */
  summary: React.ReactNode;
  /** 펼쳤을 때 상세 내용 */
  children: React.ReactNode;
  /** 초기 펼침 여부 (localStorage 없을 때만 사용) */
  defaultOpen?: boolean;
};

function readStoredOpen(id: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return defaultOpen;
}

function writeStoredOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, open ? "1" : "0");
  } catch {
    // ignore
  }
}

export function HintDisclosure({
  id,
  summary,
  children,
  defaultOpen = false,
}: HintDisclosureProps) {
  const [open, setOpen] = useState<boolean>(() => readStoredOpen(id, defaultOpen));
  const contentId = useId().replace(/:/g, "-");
  const buttonId = useId().replace(/:/g, "-");

  useEffect(() => {
    writeStoredOpen(id, open);
  }, [id, open]);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50">
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div className="text-sm text-[var(--text-primary)]">{summary}</div>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          className="flex h-10 min-h-[40px] w-10 min-w-[40px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
          title={open ? "도움말 접기" : "도움말 펼치기"}
        >
          i
        </button>
      </div>
      {open && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-[var(--border)] px-3 pb-3 pt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap"
        >
          {children}
        </div>
      )}
    </div>
  );
}

```

## FILE: src/components/ui/Badge.tsx

```ts
import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant =
  | "neutral"
  | "primary"
  | "premium"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "default"
  | "blue"
  | "gold";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

/** neutral: surface-muted/text-muted. primary: primary-soft/primary. premium: secondary/white. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  let variantClass: string;

  switch (variant) {
    case "primary":
      variantClass =
        "border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]";
      break;
    case "premium":
      variantClass =
        "border border-transparent bg-[var(--secondary)] text-white";
      break;
    case "outline":
      variantClass =
        "border border-[var(--border-strong)] bg-transparent text-[var(--foreground)]";
      break;
    case "success":
      variantClass =
        "border border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]";
      break;
    case "warning":
      variantClass =
        "border border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]";
      break;
    case "danger":
      variantClass =
        "border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]";
      break;
    case "neutral":
    case "default":
      variantClass =
        "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
      break;
    case "blue":
      variantClass =
        "border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]";
      break;
    case "gold":
      variantClass =
        "border border-transparent bg-[var(--secondary)] text-white";
      break;
    default:
      variantClass =
        "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 type-caption font-semibold",
        variantClass,
        className,
      )}
      {...props}
    />
  );
}

```

