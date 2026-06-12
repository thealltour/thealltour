"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toMessageSendErrorText } from "@/lib/messages/messageErrorText";
import {
  createMessageFingerprint,
  DEFAULT_SEND_COOLDOWN_MS,
  isDuplicateSendCandidate,
} from "@/lib/messages/messageSendGuard";
import { normalizePhone } from "./messageSend.utils";

type SendResponseJson = {
  ok?: boolean;
  code?: string;
  message?: string;
  failureReason?: string;
  retryable?: boolean;
  sentAt?: string;
};

type UseSmsSendOptions = {
  inquiryId?: string | null;
  onSent?: () => void;
  onThreadRefetch?: () => Promise<void>;
};

export function useSmsSend({ inquiryId = null, onSent, onThreadRefetch }: UseSmsSendOptions) {
  const [sending, setSending] = useState(false);
  const inFlightRef = useRef(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<ReturnType<typeof toMessageSendErrorText> | null>(null);
  const [duplicateBlockReason, setDuplicateBlockReason] = useState<string | null>(null);
  const [lastSentFingerprint, setLastSentFingerprint] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  useEffect(() => {
    setSendError(null);
    setDuplicateBlockReason(null);
    setSendSuccess(false);
    setLastSentFingerprint(null);
    setLastSentAt(null);
    inFlightRef.current = false;
    setSending(false);
  }, [inquiryId]);

  useEffect(() => {
    if (!sendSuccess) return;
    const t = window.setTimeout(() => setSendSuccess(false), 4500);
    return () => window.clearTimeout(t);
  }, [sendSuccess]);

  const clearDuplicateBlock = useCallback(() => {
    setDuplicateBlockReason(null);
  }, []);

  const sendMessage = useCallback(
    async (input: { receiver: string; message: string; onMessageClear?: () => void }) => {
      if (inFlightRef.current || sending) return false;

      setSendError(null);
      setDuplicateBlockReason(null);
      setSendSuccess(false);

      const to = normalizePhone(input.receiver);
      const body = input.message.trim();

      if (!to) {
        setSendError(
          toMessageSendErrorText({ code: "INVALID_PHONE", message: "수신번호를 입력해 주세요." }),
        );
        return false;
      }
      if (!body) {
        setSendError(toMessageSendErrorText({ code: "EMPTY_MESSAGE" }));
        return false;
      }

      const fpKey = inquiryId ?? `phone:${to}`;
      const fp = createMessageFingerprint({ inquiryId: fpKey, phone: to, text: body });
      if (
        isDuplicateSendCandidate({
          nextFingerprint: fp,
          lastSentFingerprint,
          lastSentAt,
          cooldownMs: DEFAULT_SEND_COOLDOWN_MS,
        })
      ) {
        setDuplicateBlockReason("같은 내용의 문자가 방금 발송되어 중복 발송을 막았습니다.");
        return false;
      }

      inFlightRef.current = true;
      setSending(true);

      try {
        const res = await fetch("/api/admin/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: body,
            receiver: to,
            inquiry_id: inquiryId,
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
          input.onMessageClear?.();
          await onThreadRefetch?.();
          onSent?.();
          return true;
        }

        setSendError(
          toMessageSendErrorText({
            httpStatus: res.status,
            code: data.code,
            message: data.message,
            failureReason: data.failureReason,
          }),
        );
        await onThreadRefetch?.();
        onSent?.();
        return false;
      } catch (e) {
        console.debug("[useSmsSend] send failed", e);
        setSendError(toMessageSendErrorText({ isNetworkError: true }));
        return false;
      } finally {
        setSending(false);
        inFlightRef.current = false;
      }
    },
    [inquiryId, lastSentAt, lastSentFingerprint, onSent, onThreadRefetch, sending],
  );

  return {
    sending,
    sendSuccess,
    sendError,
    duplicateBlockReason,
    clearDuplicateBlock,
    sendMessage,
  };
}
