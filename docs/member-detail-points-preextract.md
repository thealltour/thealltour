# 회원 상세/포인트 지급 사전 발췌

아래는 요청하신 파일의 전체 원문입니다.

## 참고: 경로 없음
- src/components/ui/**/*dialog*.tsx (해당 파일 없음)
- src/components/ui/**/*drawer*.tsx (해당 파일 없음)
- src/components/ui/**/*sheet*.tsx (해당 파일 없음)

## FILE: src/components/admin/AdminMemberTable.tsx

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showAgreeEmailOnly, setShowAgreeEmailOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
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
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>
              <th className="w-[40%] px-4 py-3 text-left font-semibold">
                <SortButton
                  label="회원"
                  isActive={sortKey === "name"}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                />
              </th>
              <th className="w-[15%] px-4 py-3 text-left font-semibold">
                <SortButton
                  label="수신동의"
                  isActive={sortKey === "agree_email"}
                  direction={sortDirection}
                  onClick={() => handleSort("agree_email")}
                />
              </th>
              <th className="w-[15%] px-4 py-3 text-right font-semibold">
                <SortButton
                  label="포인트"
                  isActive={sortKey === "points"}
                  direction={sortDirection}
                  onClick={() => handleSort("points")}
                />
              </th>
              <th className="w-[20%] px-4 py-3 text-left font-semibold">
                <SortButton
                  label="가입일"
                  isActive={sortKey === "created_at"}
                  direction={sortDirection}
                  onClick={() => handleSort("created_at")}
                />
              </th>
              <th className="w-[10%] px-4 py-3 text-left font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {pagedMembers.length === 0 ? (
              <tr className="border-t border-[var(--divider)]">
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  회원 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              pagedMembers.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-[var(--divider)] hover:bg-gray-50"
                  onClick={() => router.push(`/admin/members/${item.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{item.name || "-"}</span>
                      <span className="text-xs text-gray-500">{item.username}</span>
                      <span className="text-xs text-gray-400">{item.email || "-"}</span>
                      <span className="text-xs text-gray-400">{item.phone || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        item.agree_email
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.agree_email ? "이메일 동의" : "미동의"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {item.points?.toLocaleString?.() ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => router.push(`/admin/members/${item.id}`)}
                    >
                      상세
                    </button>
                  </td>
                </tr>
              ))
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

## FILE: src/app/admin/members/[id]/page.tsx

```ts
import AdminHeader from "@/components/admin/AdminHeader";
import AdminMemberDetailPage from "@/components/admin/members/AdminMemberDetailPage";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminMemberDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="members"
          title="회원 상세"
          description="회원 기본 정보와 포인트 현황을 확인합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminMemberDetailPage memberId={id} />
        </section>
      </main>
    </div>
  );
}

```

## FILE: src/app/theall_manager_only/members/[id]/page.tsx

```ts
export { default } from "@/app/admin/members/[id]/page";

```

## FILE: src/components/admin/members/AdminMemberDetailPage.tsx

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";

type Props = {
  memberId: string;
};

type MemberDetail = {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
  points?: number;
  point_balance?: number;
  point_pending?: number;
  created_at: string | null;
};

type PointLedgerRow = {
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
  ADJUST: "조정",
  EXPIRE: "소멸",
  RESERVE: "예약",
  RELEASE: "해제",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "확정",
  PENDING: "대기",
  CANCELED: "취소",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function genderLabel(gender: MemberDetail["gender"]) {
  if (gender === "male") return "남성";
  if (gender === "female") return "여성";
  return "기타";
}

export default function AdminMemberDetailPage({ memberId }: Props) {
  const router = useRouter();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [ledger, setLedger] = useState<PointLedgerRow[]>([]);
  const [isLoadingMember, setIsLoadingMember] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ledgerErrorMessage, setLedgerErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setErrorMessage("");
        setLedgerErrorMessage("");
        setIsLoadingMember(true);
        setIsLoadingLedger(true);

        const [memberResponse, ledgerResponse] = await Promise.all([
          fetch(`/api/admin/members/${memberId}`, { cache: "no-store" }),
          fetch(`/api/admin/members/${memberId}/point-ledger?limit=20`, { cache: "no-store" }),
        ]);

        const memberResult = (await memberResponse.json()) as
          | MemberDetail
          | { message?: string };
        if (!memberResponse.ok) {
          const msg =
            "message" in memberResult
              ? memberResult.message
              : "회원 정보를 불러오지 못했습니다.";
          if (mounted) setErrorMessage(msg ?? "회원 정보를 불러오지 못했습니다.");
          return;
        }

        if (mounted) setMember(memberResult as MemberDetail);

        const ledgerResult = (await ledgerResponse.json()) as
          | PointLedgerRow[]
          | { message?: string };
        if (!ledgerResponse.ok) {
          const msg =
            "message" in ledgerResult
              ? ledgerResult.message
              : "포인트 내역을 불러오지 못했습니다.";
          if (mounted) {
            setLedger([]);
            setLedgerErrorMessage(msg ?? "포인트 내역을 불러오지 못했습니다.");
          }
          return;
        }

        if (mounted) setLedger(Array.isArray(ledgerResult) ? ledgerResult : []);
      } catch {
        if (mounted) {
          setErrorMessage("회원 상세 정보를 불러오는 중 오류가 발생했습니다.");
          setLedger([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingMember(false);
          setIsLoadingLedger(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const pointBalance = useMemo(() => {
    if (!member) return 0;
    const raw = member.point_balance ?? member.points ?? 0;
    return Number(raw) || 0;
  }, [member]);

  const pointPending = useMemo(() => {
    if (!member) return 0;
    return Number(member.point_pending ?? 0) || 0;
  }, [member]);

  if (isLoadingMember) {
    return <p className="px-6 py-8 text-sm text-[var(--text-muted)]">회원 정보를 불러오는 중입니다...</p>;
  }

  if (errorMessage || !member) {
    return (
      <div className="space-y-4 px-6 py-8">
        <p className="text-sm text-[var(--danger)]">
          {errorMessage || "회원 정보를 불러오지 못했습니다."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/theall_manager_only/members")}
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
        >
          회원 목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/theall_manager_only/members")}
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
        >
          회원 목록으로
        </button>
        <p className="text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-primary)]">{member.name || "-"}</span>
          {" · "}
          {member.username}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">현재 사용 가능 포인트</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--primary)]">
            {pointBalance.toLocaleString("ko-KR")}P
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">대기 포인트</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {pointPending.toLocaleString("ko-KR")}P
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">가입일</p>
          <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {formatDate(member.created_at)}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">기본 정보</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">이름</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">아이디</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.username || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">이메일</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.email || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">연락처</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.phone || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">이메일 수신동의</p>
            <div className="mt-1">
              <Badge variant={member.agree_email ? "success" : "neutral"}>
                {member.agree_email ? "이메일 수신 동의" : "이메일 수신 미동의"}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">생년월일</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.birth_date || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">성별</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{genderLabel(member.gender)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">가입일시</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{formatDateTime(member.created_at)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">최근 포인트 내역</h3>
          <p className="text-xs text-[var(--text-muted)]">최신 20건</p>
        </div>

        {ledgerErrorMessage ? (
          <p className="mt-3 text-sm text-[var(--danger)]">{ledgerErrorMessage}</p>
        ) : null}

        {isLoadingLedger ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">포인트 내역을 불러오는 중입니다...</p>
        ) : ledger.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">포인트 내역이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">일시</th>
                  <th className="px-3 py-2 text-left font-semibold">유형</th>
                  <th className="px-3 py-2 text-left font-semibold">상태</th>
                  <th className="px-3 py-2 text-right font-semibold">포인트</th>
                  <th className="px-3 py-2 text-left font-semibold">사유</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--divider)]">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      {TYPE_LABEL[row.type] ?? row.type}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="neutral" className="px-2 py-0.5 text-[11px]">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-[var(--text-primary)]">
                      {Number(row.amount ?? 0).toLocaleString("ko-KR")}P
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{row.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

```

## FILE: src/app/api/admin/members/[id]/route.ts

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("members")
    .select(
      "id,username,name,phone,email,birth_date,gender,agree_email,points,point_balance,point_pending,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

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

## FILE: src/server/services/points/grantPoints.ts

```ts
import { supabase } from "@/lib/supabase";
import { getPointExpiresAt } from "@/config/rewardPolicy";

export type GrantPointStatus = "CONFIRMED" | "PENDING";

type GrantPointsParams = {
  userId: string;
  amount: number;
  status: GrantPointStatus;
  reason: string;
  refType?: string;
  refId?: string;
  actorAdminId?: string | null;
  expiresAt?: string | null;
};

export async function grantPointsToUser(params: GrantPointsParams) {
  const userId = params.userId.trim();
  const amount = Number(params.amount);
  if (!userId) throw new Error("userId는 필수입니다.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount는 1 이상의 숫자여야 합니다.");

  const { data: memberRow, error: memberErr } = await supabase
    .from("members")
    .select("id, point_balance, point_pending")
    .eq("id", userId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  const currentBalance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
  const currentPending = Number((memberRow as { point_pending?: number }).point_pending ?? 0);
  const status = params.status === "PENDING" ? "PENDING" : "CONFIRMED";
  const now = new Date().toISOString();

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: userId,
      type: "EARN",
      status,
      amount,
      reason: params.reason?.trim() || "관리자 지급",
      ref_type: params.refType?.trim() || null,
      ref_id: params.refId?.trim() || null,
      expires_at: params.expiresAt ?? getPointExpiresAt(),
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    throw new Error("포인트 원장 기록에 실패했습니다.");
  }

  if (status === "CONFIRMED") {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_balance: currentBalance + amount })
      .eq("id", userId);
    if (updateErr) throw new Error("포인트 반영에 실패했습니다.");
  } else {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_pending: currentPending + amount })
      .eq("id", userId);
    if (updateErr) throw new Error("대기 포인트 반영에 실패했습니다.");
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: "포인트 적립",
    body:
      status === "CONFIRMED"
        ? `${amount}P가 적립되었습니다.`
        : `${amount}P가 적립 예정입니다. (확정 후 사용 가능합니다.)`,
  });

  return {
    ledgerId: (ledgerRow as { id: string }).id,
    appliedStatus: status,
    actorAdminId: params.actorAdminId ?? null,
  };
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

## FILE: src/components/ui/Modal.tsx

```ts
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 백드롭 클릭 시 닫기 (기본 true) */
  closeOnBackdropClick?: boolean;
  /** 컨테이너 추가 클래스 (크기·패딩 등) */
  className?: string;
  /** role="dialog" 등 접근성용 */
  "aria-label"?: string;
};

/**
 * 테마 토큰 기반 공통 모달 레이아웃.
 * - 백드롭: var(--overlay)
 * - 컨테이너: var(--surface-elevated), var(--shadow-modal), var(--border)
 */
export function Modal({
  isOpen,
  onClose,
  children,
  closeOnBackdropClick = true,
  className = "",
  "aria-label": ariaLabel,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]"
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={cn(
          "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-modal)]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}

```

## FILE: src/components/admin/ui/AdminPanel.tsx

```ts
"use client";

import type { ReactNode } from "react";
import AdminCard from "./AdminCard";

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
  muted?: boolean;
};

export default function AdminPanel({
  children,
  className,
  muted = false,
}: AdminPanelProps) {
  return (
    <AdminCard
      variant={muted ? "muted" : "default"}
      className={className}
    >
      {children}
    </AdminCard>
  );
}


```

