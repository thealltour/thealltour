"use client";

import type { InquirySmsThreadItem } from "@/types/inquiry";
import { formatInquiryMessageLogTime } from "@/lib/messages/messageLogView";

const PREVIEW_CHAR_LIMIT = 120;

type Props = {
  thread: InquirySmsThreadItem[];
  isLoading: boolean;
  onRetryFailed?: (input: { phone: string; message: string }) => void;
  retrying?: boolean;
};

export function InquirySmsThread({ thread, isLoading, onRetryFailed, retrying }: Props) {
  if (isLoading) {
    return <p className="mt-2 text-xs text-[var(--text-muted)]">대화 이력 불러오는 중…</p>;
  }

  if (thread.length === 0) {
    return (
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        이 문의의 SMS 대화가 아직 없습니다.
      </p>
    );
  }

  return (
    <ul className="mt-2 max-h-[min(42vh,380px)] space-y-2 overflow-y-auto pr-0.5">
      {thread.map((item, index) => {
        const isLatest = index === thread.length - 1;
        const isInbound = item.direction === "inbound";
        const isUnread = isInbound && !item.read_at;
        const body = item.message;
        const needExpand = body.length > PREVIEW_CHAR_LIMIT;
        const collapsed = needExpand ? `${body.slice(0, PREVIEW_CHAR_LIMIT)}…` : body;
        const isFailedOutbound = !isInbound && item.send_status === "failed";

        return (
          <li
            key={`${item.direction}-${item.id}`}
            className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[92%] rounded-xl border px-3 py-2.5 text-xs ${
                isInbound
                  ? isUnread
                    ? "border-[var(--primary)]/40 bg-[var(--surface-muted)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface-muted)]/80"
                  : isFailedOutbound
                    ? "border-[var(--danger)]/30 bg-[var(--danger-bg)]/30"
                    : "border-[var(--primary)]/35 bg-[var(--primary-soft)]/25"
              } ${isLatest ? "ring-1 ring-[var(--primary)]/15" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--text-secondary)]">
                  {isInbound ? "고객 수신" : "발송"}
                </span>
                <span className="font-semibold tabular-nums text-[var(--text-muted)]">
                  {formatInquiryMessageLogTime(item.at)}
                </span>
                {isUnread ? (
                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                    NEW
                  </span>
                ) : null}
                {isFailedOutbound ? (
                  <span className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--danger)]">
                    실패
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-[var(--text-primary)]">
                {collapsed}
              </p>
              <p className="mt-1 tabular-nums text-[10px] text-[var(--text-subtle)]">{item.phone}</p>
              {isFailedOutbound && item.failure_reason ? (
                <p className="mt-1 text-[11px] text-[var(--danger)]">{item.failure_reason}</p>
              ) : null}
              {isFailedOutbound && onRetryFailed ? (
                <button
                  type="button"
                  disabled={retrying}
                  onClick={() => onRetryFailed({ phone: item.phone, message: item.message })}
                  className="mt-2 rounded border border-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--primary)] disabled:opacity-50"
                >
                  {retrying ? "재시도 중…" : "재발송"}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
