"use client";

import type { SmsLengthInfo } from "@/lib/messages/smsLength";
import { formatPhoneDisplay } from "./messageSend.utils";

type Props = {
  phoneDigits: string;
  previewText: string;
  isEmpty: boolean;
  lengthInfo: SmsLengthInfo;
};

export function MessagePreviewCard({ phoneDigits, previewText, isEmpty, lengthInfo }: Props) {
  const displayPhone = formatPhoneDisplay(phoneDigits);
  const kindClass =
    lengthInfo.kind === "LMS"
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      : "bg-[var(--primary-soft)] text-[var(--primary)]";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3 shadow-inner">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">발송 미리보기</p>
      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">수신</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{displayPhone}</span>
        </div>
        <div className="mt-2 min-h-[4.5rem]">
          {isEmpty ? (
            <p className="text-sm leading-relaxed text-[var(--text-subtle)]">
              작성한 문자 내용이 여기에서 미리 보입니다.
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-primary)]">
              {previewText}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 pt-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${kindClass}`}>
            {lengthInfo.kind === "SMS" ? "SMS(단문)" : "LMS(장문)"}
          </span>
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {lengthInfo.effectiveLength}자 · UTF-8 {lengthInfo.utf8Bytes}바이트
            {lengthInfo.kind === "SMS" && lengthInfo.remaining != null ? ` · 단문 여유 약 ${lengthInfo.remaining}B` : null}
          </span>
        </div>
      </div>
    </div>
  );
}
