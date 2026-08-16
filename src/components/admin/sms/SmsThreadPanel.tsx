"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { InquirySmsThread } from "@/components/admin/inquiries/InquirySmsThread";
import type { InquirySmsThreadItem } from "@/types/inquiry";
import { formatPhoneDisplay } from "@/components/admin/inquiries/messageSend.utils";

type LinkedInquiry = {
  id: string;
  name: string;
  phone: string;
};

type LinkedMember = {
  id: string;
  name: string;
  phone: string;
  username: string;
};

type SmsThreadPanelProps = {
  phone: string | null;
  thread: InquirySmsThreadItem[];
  unreadInboundCount: number;
  inquiry: LinkedInquiry | null;
  member: LinkedMember | null;
  isLoading: boolean;
  onRequestLink: () => void;
  onRetryFailed?: (input: { phone: string; message: string }) => void;
  retrying?: boolean;
  children?: ReactNode;
};

export function SmsThreadPanel({
  phone,
  thread,
  unreadInboundCount,
  inquiry,
  member,
  isLoading,
  onRequestLink,
  onRetryFailed,
  retrying,
  children,
}: SmsThreadPanelProps) {
  if (!phone) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        좌측에서 대화를 선택하세요.
      </div>
    );
  }

  const hasLink = Boolean(inquiry || member);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tabular-nums text-[var(--text-primary)]">
              {formatPhoneDisplay(phone)}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              수신(textbee) · 발송(알리고) 대화
            </p>
          </div>
          {unreadInboundCount > 0 ? (
            <span className="rounded-full bg-[var(--primary)] px-2.5 py-1 text-xs font-bold text-white">
              미확인 {unreadInboundCount}
            </span>
          ) : null}
        </div>

        {inquiry ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">연결된 문의</p>
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{inquiry.name}</p>
            </div>
            <Link
              href={`/theall_manager_only/inquiries?id=${encodeURIComponent(inquiry.id)}`}
              className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              문의 상세
            </Link>
          </div>
        ) : null}

        {member ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">연결된 회원</p>
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{member.name}</p>
              {member.username ? (
                <p className="truncate text-xs text-[var(--text-muted)]">@{member.username}</p>
              ) : null}
            </div>
            <Link
              href={`/theall_manager_only/members/${encodeURIComponent(member.id)}`}
              className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              회원 상세
            </Link>
          </div>
        ) : null}

        {!hasLink ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-3 py-2">
            <p className="text-sm text-[var(--warning)]">
              연결된 문의 또는 회원이 없습니다.
            </p>
            <button
              type="button"
              onClick={onRequestLink}
              className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]"
            >
              연결
            </button>
          </div>
        ) : null}
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">대화 스레드</h3>
        <InquirySmsThread
          thread={thread}
          isLoading={isLoading}
          onRetryFailed={onRetryFailed}
          retrying={retrying}
        />
      </section>

      {children}
    </div>
  );
}
