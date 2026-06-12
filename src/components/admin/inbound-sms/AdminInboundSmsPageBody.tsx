"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminHeader from "@/components/admin/AdminHeader";
import type { InquiryInboundSms } from "@/types/inquiry";
import { formatInquiryMessageLogTime } from "@/lib/messages/messageLogView";

type AdminInboundSmsPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export function AdminInboundSmsPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
}: AdminInboundSmsPageBodyProps) {
  const [items, setItems] = useState<InquiryInboundSms[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkInquiryId, setLinkInquiryId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/inbound-sms?status=unmatched", { cache: "no-store" });
      const data = (await res.json()) as { items?: InquiryInboundSms[]; total?: number };
      if (res.ok) {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLink = async (inboundSmsId: string) => {
    const inquiryId = linkInquiryId.trim();
    if (!inquiryId) {
      setMessage("연결할 문의 ID를 입력해 주세요.");
      return;
    }
    setLinkingId(inboundSmsId);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/inbound-sms/${encodeURIComponent(inboundSmsId)}/link-inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const data = (await res.json()) as { message?: string; inquiryId?: string };
      if (!res.ok) {
        setMessage(data.message ?? "연결에 실패했습니다.");
        return;
      }
      setMessage("문의에 연결되었습니다.");
      setLinkInquiryId("");
      await load();
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-5xl space-y-4">
        <AdminHeader
          activeTab="inquiries"
          title="미연결 SMS 수신"
          description="textbee로 수신했으나 기존 문의와 자동 매칭되지 않은 메시지입니다. 문의 ID로 수동 연결할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        {message ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {message}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            미연결 수신 SMS가 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-semibold tabular-nums">{formatInquiryMessageLogTime(item.received_at)}</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">{item.sender_phone}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                  {item.message}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[200px] flex-1 flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">문의 ID</span>
                    <input
                      value={linkingId === item.id ? linkInquiryId : ""}
                      onChange={(e) => {
                        setLinkingId(item.id);
                        setLinkInquiryId(e.target.value);
                      }}
                      placeholder="연결할 문의 UUID"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={linkingId === item.id && !linkInquiryId.trim()}
                    onClick={() => void handleLink(item.id)}
                    className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                  >
                    문의 연결
                  </button>
                  <Link
                    href={`/theall_manager_only/inquiries?search=${encodeURIComponent(item.sender_phone)}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    번호로 문의 검색
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && total > items.length ? (
          <p className="text-xs text-[var(--text-muted)]">총 {total}건 중 {items.length}건 표시</p>
        ) : null}
      </main>
    </div>
  );
}

