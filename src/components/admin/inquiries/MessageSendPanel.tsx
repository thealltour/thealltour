"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMessagePreview } from "@/lib/messages/messagePreview";
import { toMessageSendErrorText } from "@/lib/messages/messageErrorText";
import {
  createMessageFingerprint,
  DEFAULT_SEND_COOLDOWN_MS,
  isDuplicateSendCandidate,
} from "@/lib/messages/messageSendGuard";
import { getSmsLengthInfo } from "@/lib/messages/smsLength";
import type { MessageSendPanelProps } from "./messageSend.types";
import {
  applyTemplateToMessage,
  buildDefaultCustomerSms,
  buildFirstResponseSms,
  buildFirstTemplateSms,
  buildPhoneScriptSms,
  normalizePhone,
} from "./messageSend.utils";
import { InquiryMessageLogList } from "./InquiryMessageLogList";
import { MessagePreviewCard } from "./MessagePreviewCard";
import { useInquiryMessageLogs } from "./useInquiryMessageLogs";
import { useAdminToast } from "@/components/admin/AdminToastProvider";

type SendResponseJson = {
  ok?: boolean;
  code?: string;
  message?: string;
  failureReason?: string;
  retryable?: boolean;
  sentAt?: string;
};

export function MessageSendPanel({
  inquiry,
  message,
  onMessageChange,
  templateInsertMode,
  onTemplateInsertModeChange,
  onSent,
}: MessageSendPanelProps) {
  const { showToast } = useAdminToast();
  const [receiver, setReceiver] = useState(() => normalizePhone(inquiry.phone ?? ""));
  const [sending, setSending] = useState(false);
  const inFlightRef = useRef(false);

  const [sendingDeposit, setSendingDeposit] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<ReturnType<typeof toMessageSendErrorText> | null>(null);
  const [duplicateBlockReason, setDuplicateBlockReason] = useState<string | null>(null);

  const [lastSentFingerprint, setLastSentFingerprint] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { logs, isLoading: logsLoading, refetch: refetchLogs } = useInquiryMessageLogs(inquiry.id);

  useEffect(() => {
    setReceiver(normalizePhone(inquiry.phone ?? ""));
  }, [inquiry.id, inquiry.phone]);

  useEffect(() => {
    setSendError(null);
    setDuplicateBlockReason(null);
    setSendSuccess(false);
    setLastSentFingerprint(null);
    setLastSentAt(null);
    inFlightRef.current = false;
    setSending(false);
  }, [inquiry.id]);

  useEffect(() => {
    setDuplicateBlockReason(null);
  }, [message, receiver]);

  useEffect(() => {
    if (!sendSuccess) return;
    const t = window.setTimeout(() => setSendSuccess(false), 4500);
    return () => window.clearTimeout(t);
  }, [sendSuccess]);

  const lengthInfo = useMemo(() => getSmsLengthInfo(message), [message]);
  const previewData = useMemo(() => buildMessagePreview(message), [message]);

  const applyToComposer = useCallback(
    (templateText: string) => {
      const next = applyTemplateToMessage({
        currentText: message,
        templateText,
        mode: templateInsertMode,
      });
      onMessageChange(next);
      queueMicrotask(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      });
    },
    [message, onMessageChange, templateInsertMode],
  );

  const handleSendDepositLink = async () => {
    if (sendingDeposit || sending) return;
    setSendError(null);
    setSendingDeposit(true);
    try {
      const res = await fetch(
        `/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/send-deposit-link`,
        { method: "POST" },
      );
      const data = (await res.json()) as { message?: string; depositUrl?: string };
      if (!res.ok) {
        const errorText = toMessageSendErrorText({
          httpStatus: res.status,
          message: data.message ?? "예약금 링크 발송에 실패했습니다.",
        });
        setSendError(errorText);
        showToast("error", errorText.description || errorText.title);
        return;
      }
      const successMessage = data.message ?? "예약금 안내 링크를 발송했습니다.";
      showToast("success", successMessage);
      await refetchLogs();
      onSent?.();
    } catch {
      const errorText = toMessageSendErrorText({ isNetworkError: true });
      setSendError(errorText);
      showToast("error", errorText.description || errorText.title);
    } finally {
      setSendingDeposit(false);
    }
  };

  const handleSend = async () => {
    if (inFlightRef.current || sending) return;

    setSendError(null);
    setDuplicateBlockReason(null);
    setSendSuccess(false);

    const to = normalizePhone(receiver);
    const body = message.trim();

    if (!to) {
      setSendError(
        toMessageSendErrorText({ code: "INVALID_PHONE", message: "수신번호를 입력해 주세요." }),
      );
      return;
    }
    if (!body) {
      setSendError(toMessageSendErrorText({ code: "EMPTY_MESSAGE" }));
      return;
    }

    const fp = createMessageFingerprint({ inquiryId: inquiry.id, phone: to, text: body });
    if (
      isDuplicateSendCandidate({
        nextFingerprint: fp,
        lastSentFingerprint,
        lastSentAt,
        cooldownMs: DEFAULT_SEND_COOLDOWN_MS,
      })
    ) {
      setDuplicateBlockReason("같은 내용의 문자가 방금 발송되어 중복 발송을 막았습니다.");
      return;
    }

    inFlightRef.current = true;
    setSending(true);

    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: body,
          receiver: to,
          actor_name: "관리자",
        }),
      });

      let data: SendResponseJson = {};
      try {
        data = (await res.json()) as SendResponseJson;
      } catch {
        data = {};
      }

      if (res.ok && data.ok) {
        const sentAt = typeof data.sentAt === "string" ? data.sentAt : new Date().toISOString();
        setLastSentFingerprint(fp);
        setLastSentAt(sentAt);
        setSendSuccess(true);
        onMessageChange("");
        await refetchLogs();
        onSent?.();
        return;
      }

      setSendError(
        toMessageSendErrorText({
          httpStatus: res.status,
          code: data.code,
          message: data.message,
          failureReason: data.failureReason,
        }),
      );
      await refetchLogs();
      onSent?.();
    } catch (e) {
      console.debug("[MessageSendPanel] send failed", e);
      setSendError(toMessageSendErrorText({ isNetworkError: true }));
    } finally {
      setSending(false);
      inFlightRef.current = false;
    }
  };

  const firstTpl = buildFirstTemplateSms(inquiry);
  const phoneScriptText = buildPhoneScriptSms(inquiry);

  const canSend =
    normalizePhone(receiver).length > 0 &&
    message.trim().length > 0 &&
    !sending &&
    !duplicateBlockReason;

  const lengthTone =
    lengthInfo.kind === "LMS"
      ? "text-amber-800 dark:text-amber-200"
      : lengthInfo.remaining != null && lengthInfo.remaining <= 10
        ? "text-amber-700 dark:text-amber-300"
        : "text-[var(--text-muted)]";

  return (
    <div className="space-y-4">
      <header className="px-0.5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">문자 발송</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">고객에게 SMS 전송 (알리고 relay)</p>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">수신 정보</h3>
        <dl className="mt-2 space-y-2 text-xs">
          <div>
            <dt className="font-medium text-[var(--text-muted)]">고객명</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{inquiry.name || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--text-muted)]">수신번호</dt>
            <dd className="mt-1">
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={receiver}
                onChange={(e) => setReceiver(normalizePhone(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                placeholder="01012345678"
              />
              <p className="mt-1 text-[11px] text-[var(--text-subtle)]">
                저장·발송은 숫자만 사용합니다. 미리보기에서만 하이픈 표시됩니다.
              </p>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">메시지</h3>
          <div className={`flex flex-wrap items-center gap-2 text-xs font-medium tabular-nums ${lengthTone}`}>
            <span>
              현재 {lengthInfo.effectiveLength}자 · {lengthInfo.kind}
            </span>
            <span className="text-[var(--text-subtle)]">· UTF-8 {lengthInfo.utf8Bytes}B</span>
          </div>
        </div>

        <div className="mt-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">템플릿 삽입 방식</span>
          <div className="mt-1.5 inline-flex rounded-lg border border-[var(--border)] p-0.5">
            {(["replace", "append"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onTemplateInsertModeChange(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  templateInsertMode === mode
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {mode === "replace" ? "덮어쓰기" : "뒤에 추가"}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={12}
          className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          placeholder={
            "운영자용 안내 문자를 입력해 주세요.\n템플릿을 삽입한 뒤 수정해서 발송할 수 있습니다."
          }
        />

        {lengthInfo.warning ? (
          <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-200">{lengthInfo.warning}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyToComposer(buildFirstResponseSms(inquiry))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]/40"
          >
            1차 응대 넣기
          </button>
          <button
            type="button"
            disabled={!firstTpl}
            onClick={() => firstTpl && applyToComposer(firstTpl)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            대표 템플릿 넣기
          </button>
          <button
            type="button"
            onClick={() => applyToComposer(buildDefaultCustomerSms(inquiry))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]/40"
          >
            기본 안내 문구
          </button>
          {phoneScriptText ? (
            <button
              type="button"
              onClick={() => applyToComposer(phoneScriptText)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]/40"
            >
              전화 스크립트 넣기
            </button>
          ) : null}
          <button
            type="button"
            disabled={sendingDeposit || !normalizePhone(receiver)}
            onClick={() => void handleSendDepositLink()}
            className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendingDeposit ? "예약금 링크 발송 중…" : "예약금 링크 SMS 발송"}
          </button>
          <button
            type="button"
            onClick={() => onMessageChange("")}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--border)]/40"
          >
            초기화
          </button>
        </div>

        <div className="mt-4">
          <MessagePreviewCard
            phoneDigits={receiver}
            previewText={previewData.normalizedText}
            isEmpty={previewData.isEmpty}
            lengthInfo={lengthInfo}
          />
        </div>
      </section>

      {duplicateBlockReason ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {duplicateBlockReason}
        </div>
      ) : null}

      {sendError ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm"
        >
          <p className="font-semibold text-[var(--danger)]">{sendError.title}</p>
          <p className="mt-1 text-[var(--text-secondary)]">{sendError.description}</p>
          {sendError.retryable ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">잠시 후 다시 시도할 수 있습니다.</p>
          ) : null}
        </div>
      ) : null}

      {sendSuccess ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]"
        >
          문자 발송이 완료되었습니다. 아래 최근 이력에서 결과를 확인할 수 있습니다.
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="w-full rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "발송 중…" : `문자 보내기 (${lengthInfo.kind})`}
        </button>
        <p className="text-center text-[11px] text-[var(--text-subtle)]">
          발송 중에는 중복 요청이 차단됩니다. 동일 문의·번호·본문은 {DEFAULT_SEND_COOLDOWN_MS / 1000}초 이내 재발송할 수 없습니다.
        </p>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">최근 발송 이력</h3>
        <InquiryMessageLogList logs={logs} isLoading={logsLoading} />
      </section>
    </div>
  );
}
