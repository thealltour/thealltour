"use client";

import { useState } from "react";
import type { InquiryMessageLog } from "@/types/inquiry";
import { formatInquiryMessageLogTime } from "@/lib/messages/messageLogView";

const PREVIEW_CHAR_LIMIT = 120;

type Props = {
  logs: InquiryMessageLog[];
  isLoading: boolean;
};

export function InquiryMessageLogList({ logs, isLoading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="mt-2 text-xs text-[var(--text-muted)]">불러오는 중…</p>;
  }

  if (logs.length === 0) {
    return (
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        이 문의에 발송된 문자가 아직 없습니다.
      </p>
    );
  }

  return (
    <ul className="mt-2 max-h-[min(40vh,360px)] space-y-2 overflow-y-auto pr-0.5">
      {logs.map((log, index) => {
        const isLatest = index === 0;
        const expanded = expandedId === log.id;
        const body = log.message;
        const needExpand = body.length > PREVIEW_CHAR_LIMIT;
        const collapsed = needExpand ? `${body.slice(0, PREVIEW_CHAR_LIMIT)}…` : body;

        return (
          <li
            key={log.id}
            className={`rounded-lg border px-3 py-2.5 text-xs transition ${
              isLatest
                ? "border-[var(--primary)]/35 bg-[var(--primary-soft)]/25 shadow-sm"
                : "border-[var(--border)] bg-[var(--surface)]/80"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums text-[var(--text-muted)]">
                {formatInquiryMessageLogTime(log.created_at)}
              </span>
              <span
                className={
                  log.send_status === "success"
                    ? "rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]"
                    : "rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--danger)]"
                }
              >
                {log.send_status === "success" ? "성공" : "실패"}
              </span>
              <span className="tabular-nums text-[var(--text-secondary)]">{log.recipient_phone}</span>
              {log.actor_name ? (
                <span className="text-[var(--text-subtle)]">· {log.actor_name}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
              className="mt-1.5 w-full rounded-md border border-transparent px-0 text-left text-[var(--text-primary)] hover:border-[var(--border)]/60 hover:bg-[var(--surface-muted)]/50"
            >
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {expanded ? body : collapsed}
              </p>
              {needExpand ? (
                <span className="mt-1 inline-block text-[11px] font-medium text-[var(--primary)]">
                  {expanded ? "접기" : "전체 보기"}
                </span>
              ) : null}
            </button>
            {log.failure_reason && log.send_status === "failed" ? (
              <p className="mt-1 text-[11px] text-[var(--danger)]">{log.failure_reason}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
