"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAdminToast } from "@/components/admin/AdminToastProvider";

type LinkedInquiry = {
  id: string;
  name: string;
  phone: string;
  product_title: string | null;
  booking_status: string | null;
  created_at: string | null;
  link_source: "member_id" | "profile";
};

type Props = {
  memberId: string;
  memberPhone: string;
  onChanged?: () => void;
};

const BOOKING_LABEL: Record<string, string> = {
  none: "미예약",
  reserved: "예약 확정",
  completed: "여행 완료",
  canceled: "취소",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export function MemberInquiryLinkPanel({ memberId, memberPhone, onChanged }: Props) {
  const { showToast } = useAdminToast();
  const [linkedInquiries, setLinkedInquiries] = useState<LinkedInquiry[]>([]);
  const [connectableInquiries, setConnectableInquiries] = useState<LinkedInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadInquiries = useCallback(
    async (search?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search?.trim()) params.set("search", search.trim());
        const qs = params.toString();
        const res = await fetch(`/api/admin/members/${memberId}/inquiries${qs ? `?${qs}` : ""}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          linkedInquiries?: LinkedInquiry[];
          connectableInquiries?: LinkedInquiry[];
          message?: string;
        };
        if (!res.ok) {
          showToast("error", data.message ?? "문의 목록을 불러오지 못했습니다.");
          return;
        }
        setLinkedInquiries(Array.isArray(data.linkedInquiries) ? data.linkedInquiries : []);
        setConnectableInquiries(Array.isArray(data.connectableInquiries) ? data.connectableInquiries : []);
      } catch {
        showToast("error", "문의 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [memberId, showToast],
  );

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

  async function handleSearch() {
    setSearching(true);
    try {
      await loadInquiries(searchQuery);
    } finally {
      setSearching(false);
    }
  }

  async function handleLink(inquiryId: string) {
    if (linking) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const data = (await res.json()) as {
        message?: string;
        linkedInquiries?: LinkedInquiry[];
      };
      if (!res.ok) {
        showToast("error", data.message ?? "문의 연결에 실패했습니다.");
        return;
      }
      if (Array.isArray(data.linkedInquiries)) setLinkedInquiries(data.linkedInquiries);
      showToast("success", data.message ?? "문의가 연결되었습니다.");
      setSearchQuery("");
      await loadInquiries();
      onChanged?.();
    } catch {
      showToast("error", "문의 연결 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkByPhone() {
    if (linking || !memberPhone) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/inquiries`, { cache: "no-store" });
      const data = (await res.json()) as { connectableInquiries?: LinkedInquiry[]; message?: string };
      if (!res.ok) {
        showToast("error", data.message ?? "문의를 찾지 못했습니다.");
        return;
      }
      const connectable = Array.isArray(data.connectableInquiries) ? data.connectableInquiries : [];
      setConnectableInquiries(connectable);
      if (connectable.length === 1) {
        await handleLink(connectable[0].id);
        return;
      }
      if (connectable.length === 0) {
        showToast("error", "동일 연락처로 연결 가능한 문의가 없습니다.");
        return;
      }
      showToast("success", `동일 연락처 문의 ${connectable.length}건을 확인했습니다. 아래에서 선택해 연결하세요.`);
    } catch {
      showToast("error", "문의 검색 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(inquiryId: string) {
    if (linking) return;
    setLinking(true);
    try {
      const res = await fetch(
        `/api/admin/members/${memberId}/inquiries?inquiryId=${encodeURIComponent(inquiryId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as {
        message?: string;
        linkedInquiries?: LinkedInquiry[];
      };
      if (!res.ok) {
        showToast("error", data.message ?? "문의 연결 해제에 실패했습니다.");
        return;
      }
      if (Array.isArray(data.linkedInquiries)) setLinkedInquiries(data.linkedInquiries);
      showToast("success", data.message ?? "문의 연결이 해제되었습니다.");
      await loadInquiries(searchQuery);
      onChanged?.();
    } catch {
      showToast("error", "문의 연결 해제 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">문의 연결</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        이 회원과 문의를 연결합니다. 문의 관리 화면의 「회원 연결」과 동일하게 반영됩니다.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">문의 목록을 불러오는 중입니다...</p>
      ) : (
        <>
          {linkedInquiries.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)]">연결된 문의</p>
              <ul className="space-y-2">
                {linkedInquiries.map((inq) => (
                  <li
                    key={inq.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-[var(--text-primary)]">
                        {inq.product_title || "일반 문의"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {inq.name} · {inq.phone} · {formatDate(inq.created_at)} ·{" "}
                        {BOOKING_LABEL[inq.booking_status ?? "none"] ?? inq.booking_status ?? "-"}
                        {inq.link_source === "profile" ? " · 프로필 연동" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href="/theall_manager_only/inquiries"
                        className="text-xs text-[var(--primary)] underline-offset-2 hover:underline"
                      >
                        문의 관리
                      </Link>
                      {inq.link_source === "member_id" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlink(inq.id)}
                          disabled={linking}
                        >
                          연결 해제
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">연결된 문의가 없습니다.</p>
          )}

          <div className="mt-4 space-y-2 rounded-xl border border-dashed border-[var(--border)] p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">문의 검색·연결</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLinkByPhone}
              disabled={linking || !memberPhone}
            >
              회원 연락처로 문의 찾기
            </Button>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고객명·연락처·상품명 검색"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearch();
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleSearch} disabled={searching}>
                검색
              </Button>
            </div>
            {connectableInquiries.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {connectableInquiries.map((inq) => (
                  <li key={inq.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-[var(--text-primary)]">
                      {inq.product_title || "일반 문의"} · {inq.name} · {inq.phone}
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleLink(inq.id)}
                      disabled={linking}
                    >
                      연결
                    </Button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.trim() ? (
              <p className="text-xs text-[var(--text-muted)]">검색 결과가 없습니다.</p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
