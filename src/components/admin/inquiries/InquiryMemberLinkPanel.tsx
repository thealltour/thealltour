"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import type { Inquiry } from "@/types/inquiry";

type LinkedMember = {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
};

type Props = {
  inquiry: Inquiry;
  onLinked?: (memberId: string) => void;
  onUnlinked?: () => void;
};

export function InquiryMemberLinkPanel({ inquiry, onLinked, onUnlinked }: Props) {
  const { showToast } = useAdminToast();
  const [linkedMember, setLinkedMember] = useState<LinkedMember | null>(null);
  const [linkSource, setLinkSource] = useState<"member_id" | "profile" | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LinkedMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadLinkedMember = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/link-member`, { cache: "no-store" });
      const data = (await res.json()) as {
        linked?: boolean;
        member?: LinkedMember | null;
        link_source?: "member_id" | "profile";
      };
      if (res.ok && data.linked && data.member) {
        setLinkedMember(data.member);
        setLinkSource(data.link_source ?? "member_id");
      } else {
        setLinkedMember(null);
        setLinkSource(null);
      }
    } catch {
      setLinkedMember(null);
    } finally {
      setLoading(false);
    }
  }, [inquiry.id, inquiry.member_id]);

  useEffect(() => {
    void loadLinkedMember();
  }, [loadLinkedMember]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await res.json()) as LinkedMember[] | { message?: string };
      if (res.ok && Array.isArray(data)) {
        setSearchResults(data.slice(0, 8));
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleLink(memberId: string) {
    if (linking) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/link-member`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      const data = (await res.json()) as { message?: string; member?: LinkedMember; claimedCount?: number };
      if (!res.ok) {
        showToast("error", data.message ?? "회원 연결에 실패했습니다.");
        return;
      }
      if (data.member) setLinkedMember(data.member);
      showToast("success", data.message ?? "회원이 연결되었습니다.");
      onLinked?.(memberId);
      setSearchResults([]);
      setSearchQuery("");
    } catch {
      showToast("error", "회원 연결 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkByPhone() {
    const phone = inquiry.phone?.trim();
    if (!phone) {
      showToast("error", "문의에 연락처가 없습니다.");
      return;
    }
    if (linking) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/link-member`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { message?: string; member?: LinkedMember };
      if (!res.ok) {
        showToast("error", data.message ?? "동일 연락처 회원을 찾지 못했습니다.");
        return;
      }
      if (data.member) setLinkedMember(data.member);
      showToast("success", data.message ?? "회원이 연결되었습니다.");
      onLinked?.(data.member?.id ?? "");
    } catch {
      showToast("error", "회원 연결 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (linking) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/link-member`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        showToast("error", data.message ?? "연결 해제에 실패했습니다.");
        return;
      }
      setLinkedMember(null);
      showToast("success", data.message ?? "회원 연결이 해제되었습니다.");
      onUnlinked?.();
    } catch {
      showToast("error", "연결 해제 중 오류가 발생했습니다.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
      <h3 className="text-xs font-semibold text-[var(--text-muted)]">회원 연결</h3>
      <p className="mt-1 text-xs text-[var(--text-subtle)]">
        비회원 문의를 회원 계정과 연결하면, 여행 완료 후 마이페이지에서 리뷰 작성이 가능합니다.
      </p>

      {loading ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">불러오는 중…</p>
      ) : linkedMember ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            <p className="font-medium text-[var(--text-primary)]">
              {linkedMember.name} · {linkedMember.username}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {linkedMember.phone} · {linkedMember.email}
              {linkSource === "profile" ? " · 고객 프로필 연동" : ""}
            </p>
            <Link
              href={`/theall_manager_only/members/${linkedMember.id}`}
              className="mt-1 inline-block text-xs text-[var(--primary)] underline-offset-2 hover:underline"
            >
              회원 상세 보기
            </Link>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleUnlink} disabled={linking}>
            연결 해제
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLinkByPhone}
            disabled={linking || !inquiry.phone}
          >
            문의 연락처로 회원 찾기
          </Button>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="아이디·이름·연락처 검색"
              className="h-8 min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleSearch} disabled={searching}>
              검색
            </Button>
          </div>
          {searchResults.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] p-2">
              {searchResults.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-[var(--text-primary)]">
                    {m.name} · {m.username} · {m.phone}
                  </span>
                  <Button type="button" variant="primary" size="sm" onClick={() => handleLink(m.id)} disabled={linking}>
                    연결
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
