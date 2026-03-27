"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import AdminMemberDetailDrawer from "@/components/admin/members/AdminMemberDetailDrawer";

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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-auto min-h-0 rounded-md px-1.5 py-0.5 text-xs ${
        isActive
          ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
          : "text-[var(--primary)] hover:bg-[var(--primary-soft)]"
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px] leading-none">
        {isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </Button>
  );
}

export default function AdminMemberTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const selectedMemberId = searchParams.get("memberId");
  const isDrawerOpen = Boolean(selectedMemberId);
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

  function openMemberDrawer(memberId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("memberId", memberId);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("memberId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
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
        <Button
          type="button"
          onClick={() =>
            downloadCsv(`members-agree-email-${getDateStamp()}.csv`, agreeEmailMembers)
          }
          variant="secondary"
          size="sm"
          className="min-h-0 border border-[var(--success)]/40 bg-[var(--success-bg)] py-1.5 text-xs text-[var(--success)] hover:bg-[color:color-mix(in_oklab,var(--success)_8%,transparent)]"
        >
          동의회원 전체 CSV 다운로드
        </Button>
        <Button
          type="button"
          onClick={() =>
            downloadCsv(`members-current-filter-${getDateStamp()}.csv`, sortedMembers)
          }
          variant="outline"
          size="sm"
          className="min-h-0 py-1.5 text-xs"
        >
          현재 검색된 회원 전체 CSV 다운로드
        </Button>
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
                  className="cursor-pointer border-t border-[var(--divider)] transition-colors hover:bg-[var(--surface-muted)]"
                  onClick={() => openMemberDrawer(item.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text-primary)]">{item.name || "-"}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{item.username}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.email || "-"}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.phone || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={item.agree_email ? "success" : "neutral"}
                      className="px-2 py-0.5 text-xs font-semibold"
                    >
                      {item.agree_email ? "이메일 동의" : "미동의"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--text-primary)]">
                    {item.points?.toLocaleString?.() ?? 0}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto min-h-0 px-0 py-0 text-sm font-semibold text-[var(--primary)] hover:underline"
                      onClick={() => openMemberDrawer(item.id)}
                    >
                      상세
                    </Button>
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
          <Button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            variant="outline"
            size="sm"
            className="min-h-0 py-1 text-xs"
          >
            이전
          </Button>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            variant="outline"
            size="sm"
            className="min-h-0 py-1 text-xs"
          >
            다음
          </Button>
        </div>
      </div>

      <AdminMemberDetailDrawer
        memberId={selectedMemberId}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        members={pagedMembers}
      />
    </div>
  );
}
