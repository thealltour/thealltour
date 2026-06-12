"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMessagePreview } from "@/lib/messages/messagePreview";
import { getSmsLengthInfo } from "@/lib/messages/smsLength";
import { DEFAULT_SEND_COOLDOWN_MS } from "@/lib/messages/messageSendGuard";
import { useSmsSend } from "@/components/admin/inquiries/useSmsSend";
import { MessagePreviewCard } from "@/components/admin/inquiries/MessagePreviewCard";
import { normalizePhone } from "@/components/admin/inquiries/messageSend.utils";
import { SmsTemplateSelect } from "./SmsTemplateSelect";

type SmsComposePanelProps = {
  inquiryId: string | null;
  receiverPhone: string;
  inquiryName?: string | null;
  productTitle?: string | null;
  onSent?: () => void;
  onThreadRefetch?: () => Promise<void>;
  onRequestLink?: () => void;
};

export function SmsComposePanel({
  inquiryId,
  receiverPhone,
  inquiryName,
  productTitle,
  onSent,
  onThreadRefetch,
  onRequestLink,
}: SmsComposePanelProps) {
  const [message, setMessage] = useState("");
  const [receiver, setReceiver] = useState(() => normalizePhone(receiverPhone));

  useEffect(() => {
    setReceiver(normalizePhone(receiverPhone));
  }, [receiverPhone]);

  const { sending, sendSuccess, sendError, duplicateBlockReason, clearDuplicateBlock, sendMessage } =
    useSmsSend({
      inquiryId,
      onSent,
      onThreadRefetch,
    });

  const lengthInfo = useMemo(() => getSmsLengthInfo(message), [message]);
  const previewData = useMemo(() => buildMessagePreview(message), [message]);

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

  const handleSend = async () => {
    clearDuplicateBlock();
    await sendMessage({
      receiver,
      message,
      onMessageClear: () => setMessage(""),
    });
  };

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">문자 발송 (알리고)</h3>

      {!inquiryId ? (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <p>문의 없이 번호만으로도 발송할 수 있습니다. CS 이력은 전화번호 기준으로 저장됩니다.</p>
          {onRequestLink ? (
            <button
              type="button"
              onClick={onRequestLink}
              className="mt-2 rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]"
            >
              문의 연결 (선택)
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <label className="text-xs font-medium text-[var(--text-muted)]">수신번호</label>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={receiver}
          onChange={(e) => {
            clearDuplicateBlock();
            setReceiver(normalizePhone(e.target.value));
          }}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm tabular-nums"
          placeholder="01012345678"
        />
      </div>

      <SmsTemplateSelect
        className="mt-3"
        context={{ name: inquiryName ?? undefined, phone: receiver, product_title: productTitle ?? undefined }}
        onApply={(text) => setMessage(text)}
      />

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-[var(--text-muted)]">메시지</label>
          <span className={`text-xs font-medium tabular-nums ${lengthTone}`}>
            {lengthInfo.effectiveLength}자 · {lengthInfo.kind}
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => {
            clearDuplicateBlock();
            setMessage(e.target.value);
          }}
          rows={5}
          className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed"
          placeholder="고객에게 보낼 문자를 입력하세요."
        />
        {lengthInfo.warning ? (
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{lengthInfo.warning}</p>
        ) : null}
      </div>

      <div className="mt-3">
        <MessagePreviewCard
          phoneDigits={receiver}
          previewText={previewData.normalizedText}
          isEmpty={previewData.isEmpty}
          lengthInfo={lengthInfo}
        />
      </div>

      {duplicateBlockReason ? (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{duplicateBlockReason}</p>
      ) : null}

      {sendError ? (
        <div className="mt-2 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm">
          <p className="font-semibold text-[var(--danger)]">{sendError.title}</p>
          <p className="text-[var(--text-secondary)]">{sendError.description}</p>
        </div>
      ) : null}

      {sendSuccess ? (
        <p className="mt-2 text-sm text-[var(--success)]">문자 발송이 완료되었습니다.</p>
      ) : null}

      <button
        type="button"
        disabled={!canSend}
        onClick={() => void handleSend()}
        className="mt-3 w-full rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "발송 중…" : `문자 보내기 (${lengthInfo.kind})`}
      </button>
      <p className="mt-1 text-center text-[11px] text-[var(--text-subtle)]">
        동일 문의·번호·본문은 {DEFAULT_SEND_COOLDOWN_MS / 1000}초 이내 재발송할 수 없습니다.
      </p>
    </section>
  );
}
