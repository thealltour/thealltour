"use client";

import type { SmsConversationSummary } from "@/types/inquiry";
import { formatPhoneDisplay } from "@/components/admin/inquiries/messageSend.utils";
import { formatInquiryMessageLogTime } from "@/lib/messages/messageLogView";

type SmsConversationListProps = {
  items: SmsConversationSummary[];
  selectedPhone: string | null;
  isLoading: boolean;
  onSelect: (phone: string) => void;
};

export function SmsConversationList({
  items,
  selectedPhone,
  isLoading,
  onSelect,
}: SmsConversationListProps) {
  if (isLoading) {
    return <p className="px-3 py-4 text-sm text-[var(--text-muted)]">대화 목록 불러오는 중…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
        표시할 SMS 대화가 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((item) => {
        const isSelected = selectedPhone === item.phone;
        return (
          <li key={item.phone}>
            <button
              type="button"
              onClick={() => onSelect(item.phone)}
              className={`w-full px-3 py-3 text-left transition hover:bg-[var(--surface-muted)] ${
                isSelected ? "bg-[var(--primary-soft)]/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatPhoneDisplay(item.phone)}
                  </p>
                  {item.inquiryName ? (
                    <p className="truncate text-xs text-[var(--text-muted)]">{item.inquiryName}</p>
                  ) : item.memberName ? (
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      <span className="mr-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        회원
                      </span>
                      {item.memberName}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">미연결</p>
                  )}
                  {item.inquiryName && item.memberName ? (
                    <p className="truncate text-[10px] text-[var(--text-subtle)]">회원: {item.memberName}</p>
                  ) : null}
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {item.lastPreview}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] tabular-nums text-[var(--text-subtle)]">
                    {formatInquiryMessageLogTime(item.lastMessageAt)}
                  </span>
                  {item.unreadCount > 0 ? (
                    <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.unreadCount}
                    </span>
                  ) : null}
                  {item.matchStatus === "unmatched" && item.linkType === "none" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      미연결
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
