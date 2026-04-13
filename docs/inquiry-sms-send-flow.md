# 문자 발송 흐름 코드 추적 (관리자 MessageSendPanel → API → Relay)

이 문서는 관리자 `MessageSendPanel`에서 입력한 `message`가 API·relay·payload까지 어떻게 전달되는지, **생략 없이** 현재 레포 코드를 발췌한 것입니다.

## 흐름 요약 (핵심 결론)

| 구분 | 설명 |
|------|------|
| **관리자 발송 경로** | `MessageSendPanel` → `POST /api/admin/inquiries/[id]/send-message` → `sendAligoRelay({ receiver, msg })` → VPS `POST .../send-aligo` JSON `{ receiver, msg }` |
| **`/api/inquiries` (공개 문의 접수)** | **별도 경로**. 저장 성공 후 같은 `sendAligoRelay`를 쓰지만, `msg`는 `"[더올투어 문의접수]"` 등으로 **서버에서 조합**하고 `relayExtras`로 메타를 붙임. 관리자 패널 발송은 이 코드를 **호출하지 않음**. |
| **`sendAligoRelay` 내부** | **기본 안내문·견적 fallback 생성 로직 없음.** `params.msg`를 그대로 `msg` 필드로 실어 보냄. |
| **`buildDefaultCustomerSms` 등** | `messageSend.utils.ts`의 문구는 **프론트에서 버튼으로 삽입**할 때만 사용. API가 비어 있는 메시지를 대체하지 **않음**. |
| **공통 fetch 래퍼** | `send-message` 호출은 `MessageSendPanel`의 **네이티브 `fetch`만** 사용 (`src/lib/api` 등 공통 래퍼 없음). |

**「일반 견적 문의 안내문」이 개입하는 지점**

- **관리자 자동 치환:** 없음. 서버 `send-message`는 `body.message.trim()`만 하고 relay에 그대로 전달.
- **운영자가 넣는 보조 문구:** `buildDefaultCustomerSms` → *「안녕하세요 … 문의 주신 내용 확인 중…」* 은 **「기본 안내 문구」 버튼** 또는 템플릿/1차응대 삽입 시에만 composer에 채워짐.
- **공개 문의 접수 SMS:** `src/app/api/inquiries/route.ts`에서 **`message` 변수**로 `[더올투어 문의접수]` 블록을 만들어 `sendAligoRelay`에 넘김 (관리자 발송과 무관).

---

## [1] 프론트 → API 요청: `MessageSendPanel.tsx`

**요약:** `message`는 부모 state(`messageDraft`)와 동기화된 `message` prop. 발송 시 `body = message.trim()`으로 검증 후 JSON `message` 필드에 넣음. `inquiry.id`는 URL 경로에만 사용. **성공 시 `onMessageChange("")`로 비움.**

```tsx
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
  const [receiver, setReceiver] = useState(() => normalizePhone(inquiry.phone ?? ""));
  const [sending, setSending] = useState(false);
  const inFlightRef = useRef(false);

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
```

---

## [2] 관리자 문자 발송 API: `src/app/api/admin/inquiries/[id]/send-message/route.ts`

**요약:** `body.message`를 `trim`만 함. **fallback 문구 조합 없음.** `receiver`는 body 또는 DB `inquiry.phone`. relay는 `sendAligoRelay({ receiver, msg: message })` — **`relayExtras` 없음.** 성공/실패 모두 `inquiry_message_logs`에 동일 스키마로 insert.

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import {
  AligoRelayError,
  normalizeReceiverPhone,
  sendAligoRelay,
} from "@/lib/notifications/sendAligoRelay";

const DEFAULT_ACTOR = "관리자";

type PostBody = {
  message?: string;
  receiver?: string | null;
  actor_name?: string | null;
};

function jsonSafe(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function summarizeRelayResponse(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data !== "object" || Array.isArray(data)) {
    return { value: typeof data === "string" ? data : JSON.stringify(data).slice(0, 200) };
  }
  const o = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(o)) {
    if (n++ >= 10) break;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) out[k] = "[…]";
    else if (Array.isArray(v)) out[k] = `[${v.length} items]`;
    else out[k] = v as unknown;
  }
  return out;
}

function mapRelayErrorToApiCode(err: AligoRelayError): string {
  switch (err.code) {
    case "RELAY_TIMEOUT":
      return "RELAY_TIMEOUT";
    case "RELAY_NETWORK":
      return "RELAY_NETWORK";
    case "RELAY_HTTP":
      return "RELAY_HTTP_ERROR";
    case "EMPTY_RECEIVER":
      return "RELAY_EMPTY_RECEIVER";
    default:
      return "RELAY_FAILED";
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "JSON 본문이 올바르지 않습니다.", retryable: false },
      { status: 400 },
    );
  }

  const messageRaw = typeof body.message === "string" ? body.message : "";
  const message = messageRaw.trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, code: "EMPTY_MESSAGE", message: "메시지 내용을 입력해 주세요.", retryable: false },
      { status: 400 },
    );
  }

  const { data: inquiryRow, error: inquiryErr } = await supabase
    .from("inquiries")
    .select("id, phone")
    .eq("id", inquiryId)
    .maybeSingle();

  if (inquiryErr || !inquiryRow) {
    return NextResponse.json(
      { ok: false, code: "INQUIRY_NOT_FOUND", message: "문의를 찾을 수 없습니다.", retryable: false },
      { status: 404 },
    );
  }

  const receiverInput =
    typeof body.receiver === "string" && body.receiver.trim() ? body.receiver.trim() : String(inquiryRow.phone ?? "");
  const receiver = normalizeReceiverPhone(receiverInput);
  if (!receiver) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PHONE", message: "유효한 수신번호가 없습니다.", retryable: false },
      { status: 400 },
    );
  }

  const actorName =
    typeof body.actor_name === "string" && body.actor_name.trim() ? body.actor_name.trim() : DEFAULT_ACTOR;

  const activityMeta = {
    channel: "sms",
    recipient_phone: receiver,
    message_preview: message.slice(0, 80),
  };

  let sendStatus: "success" | "failed" = "failed";
  let providerResponse: unknown = null;
  let failureReason: string | null = null;
  let relayFailureCode: string | null = null;

  try {
    const result = await sendAligoRelay({ receiver, msg: message });
    sendStatus = "success";
    providerResponse = result.data;
  } catch (e) {
    if (e instanceof AligoRelayError) {
      relayFailureCode = mapRelayErrorToApiCode(e);
      failureReason = e.message;
      providerResponse = e.data ?? null;
    } else if (e instanceof Error) {
      relayFailureCode = "RELAY_FAILED";
      failureReason = e.message;
    } else {
      relayFailureCode = "RELAY_FAILED";
      failureReason = String(e);
    }
  }

  const providerJson = jsonSafe(providerResponse) ?? (providerResponse === null ? null : { raw: providerResponse });

  const { data: inserted, error: insertErr } = await supabase
    .from("inquiry_message_logs")
    .insert({
      inquiry_id: inquiryId,
      channel: "sms",
      recipient_phone: receiver,
      message,
      provider: "aligo_relay",
      send_status: sendStatus,
      provider_response: providerJson,
      failure_reason: failureReason,
      actor_name: actorName,
    })
    .select("id, created_at")
    .maybeSingle();

  if (insertErr) {
    console.error("[send-message] inquiry_message_logs insert failed", insertErr);
    return NextResponse.json(
      {
        ok: false,
        code: "LOG_SAVE_FAILED",
        message: "발송 로그 저장에 실패했습니다.",
        retryable: true,
      },
      { status: 500 },
    );
  }

  const logId = inserted?.id ?? null;
  const sentAt =
    typeof inserted?.created_at === "string" ? inserted.created_at : new Date().toISOString();

  const nowIso = new Date().toISOString();
  await supabase.from("inquiries").update({ last_activity_at: nowIso }).eq("id", inquiryId);

  const activitySummary = sendStatus === "success" ? "문자 발송 성공" : "문자 발송 실패";
  const { error: actErr } = await appendInquiryActivityLog(supabase, {
    inquiry_id: inquiryId,
    activity_type: "manual_log",
    actor_name: actorName,
    summary: activitySummary,
    metadata: { ...activityMeta, send_status: sendStatus, inquiry_message_log_id: logId },
  });
  if (actErr) {
    console.error("[send-message] activity log append failed", actErr);
  }

  if (sendStatus === "success") {
    return NextResponse.json({
      ok: true,
      logId,
      messageLogId: logId,
      sentAt,
      relaySummary: summarizeRelayResponse(providerResponse),
      providerResponse: providerResponse ?? null,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      code: relayFailureCode ?? "RELAY_FAILED",
      message: "문자 발송에 실패했습니다.",
      failureReason: failureReason ?? undefined,
      logId,
      messageLogId: logId,
      sentAt,
      providerResponse: providerResponse ?? null,
      relaySummary: summarizeRelayResponse(providerResponse),
      retryable: true,
    },
    { status: 502 },
  );
}
```

---

## [3] Relay 유틸: `src/lib/notifications/sendAligoRelay.ts`

**요약:** HTTP 본문은 `{ receiver, msg: params.msg, ...relayExtras }`. **`msg` 외에 `message`/`text` 필드는 설정하지 않음.** 관리자 경로는 `relayExtras` 미사용 → 실질적으로 **`receiver` + `msg`만** 전송. **일반 견적 안내문 등 fallback 생성 코드 없음.**

```ts
const RELAY_URL = "http://121.78.183.144:3000/send-aligo";
const TIMEOUT_MS = 5000;

export type AligoRelayErrorCode =
  | "EMPTY_RECEIVER"
  | "RELAY_HTTP"
  | "RELAY_TIMEOUT"
  | "RELAY_NETWORK";

export class AligoRelayError extends Error {
  readonly code: AligoRelayErrorCode;
  readonly httpStatus?: number;
  readonly data?: unknown;

  constructor(
    code: AligoRelayErrorCode,
    message: string,
    opts?: {
      httpStatus?: number;
      data?: unknown;
    },
  ) {
    super(message);
    this.name = "AligoRelayError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.data = opts?.data;
  }
}

/** 수신번호에서 숫자만 남깁니다. */
export function normalizeReceiverPhone(input: string): string {
  return input.replace(/\D/g, "");
}

export type SendAligoRelayParams = {
  receiver: string;
  msg: string;
  /** 문의 접수 등 relay 측 부가 메타(선택). receiver/msg 외 필드만 병합됩니다. */
  relayExtras?: Record<string, unknown>;
};

/**
 * 가비아 VPS 알리고 relay 서버로 SMS 발송 요청.
 * @throws 수신번호가 비어 있거나 HTTP 비정상 응답 시
 */
export async function sendAligoRelay(params: SendAligoRelayParams): Promise<{ ok: true; data: unknown }> {
  const receiver = normalizeReceiverPhone(params.receiver);
  if (!receiver) {
    throw new AligoRelayError("EMPTY_RECEIVER", "수신번호가 비어 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      receiver,
      msg: params.msg,
      ...(params.relayExtras ?? {}),
    };

    let response: Response;
    try {
      response = await fetch(RELAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new AligoRelayError("RELAY_TIMEOUT", "알리고 relay 요청 시간 초과(5초)");
      }
      if (e instanceof TypeError) {
        throw new AligoRelayError("RELAY_NETWORK", "알리고 relay 서버에 연결할 수 없습니다.");
      }
      throw e;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AligoRelayError("RELAY_HTTP", `알리고 relay HTTP ${response.status}`, {
        httpStatus: response.status,
        data,
      });
    }

    return { ok: true, data };
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## [4] `src/components/admin/inquiries/messageSend.utils.ts`

**요약:** `applyTemplateToMessage`는 replace/append만 처리. `buildDefaultCustomerSms`는 **고정 안내 한 줄** 생성(버튼용). **API로 자동 전달되지 않음.** `message`가 비는 경우: 프론트에서 `초기화`, 발송 성공 후 `onMessageChange("")`, 또는 사용자가 직접 지움.

```ts
import { normalizeReceiverPhone } from "@/lib/notifications/sendAligoRelay";
import type { Inquiry } from "@/types/inquiry";
import { analyzeInquiryGuide, getPhoneScriptByType, getTemplatesByType } from "./inquiryResponseGuide.utils";
import type { PhoneScript } from "./inquiryResponseGuide.types";

export type TemplateInsertMode = "replace" | "append";

export function normalizePhone(input: string): string {
  return normalizeReceiverPhone(input);
}

/** 표시용 하이픈(저장·발송 값은 digits 그대로 유지) */
export function formatPhoneDisplay(digits: string): string {
  const d = normalizeReceiverPhone(digits);
  if (d.length === 11 && d.startsWith("010")) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10 && d.startsWith("02")) {
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith("01")) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  return d || "—";
}

export function applyTemplateToMessage(opts: {
  currentText: string;
  templateText: string;
  mode: TemplateInsertMode;
}): string {
  const tpl = opts.templateText;
  if (opts.mode === "replace") return tpl;
  const cur = opts.currentText;
  if (!cur.trim()) return tpl;
  const sep = cur.endsWith("\n") ? "\n" : "\n\n";
  return `${cur}${sep}${tpl}`;
}

export function buildDefaultCustomerSms(inquiry: Inquiry): string {
  const name = (inquiry.name ?? "").trim() || "고객";
  return `안녕하세요 ${name}님,\n문의 주신 내용 확인 중이며 확인 후 안내드리겠습니다.`;
}

export function buildFirstResponseSms(inquiry: Inquiry): string {
  return analyzeInquiryGuide(inquiry).generatedMessage;
}

export function buildFirstTemplateSms(inquiry: Inquiry): string | null {
  const analysis = analyzeInquiryGuide(inquiry);
  const templates = getTemplatesByType(analysis.type);
  const first = templates[0];
  return first ? first.build(inquiry) : null;
}

export function formatPhoneScriptForSms(script: PhoneScript): string {
  return [
    "【오프닝】",
    ...script.opening,
    "",
    "【핵심 질문】",
    ...script.questions,
    "",
    "【마무리】",
    ...script.closing,
  ].join("\n");
}

export function buildPhoneScriptSms(inquiry: Inquiry): string | null {
  const analysis = analyzeInquiryGuide(inquiry);
  const script = getPhoneScriptByType(analysis.type);
  return script ? formatPhoneScriptForSms(script) : null;
}
```

---

## [5] API 호출 공통 유틸

**요약:** `send-message`는 **`MessageSendPanel`의 `fetch` 직접 호출**만 사용. `src/lib/api` 등의 전용 래퍼는 **없음** (레포 내 `send-message` 문자열 검색 기준).

---

## [6] 공개 문의 접수 시 문자: `src/app/api/inquiries/route.ts` (발췌)

**요약:** POST 저장 성공 후 **별도의 `message` 문자열**을 조합해 `sendAligoRelay` 호출. 이는 **고객이 폼에 넣은 `content`를 그대로 보내는 것이 아니라**, 운영 알림용 블록 템플릿. **관리자 `send-message`와 코드 경로가 다름.**

상단 import:

```ts
import { normalizeReceiverPhone, sendAligoRelay } from "@/lib/notifications/sendAligoRelay";
```

문의 저장 이후 relay 호출 부분 (함수 후반, 발췌):

```ts
  // 문의 저장 성공 이후: 가비아 알리고 중계 서버 호출 (부수효과, 실패해도 응답 유지)
  const normalizedPhone = normalizeReceiverPhone(phone);
  const message = [
    "[더올투어 문의접수]",
    `이름: ${name}`,
    `연락처: ${normalizedPhone}`,
    productTitle ? `상품: ${productTitle}` : null,
    sourcePath ? `유입: ${sourcePath}` : null,
    contentValue ? `문의내용: ${contentValue}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    console.log("[inquiries] calling aligo relay server", {
      inquiryId,
      phone,
      normalizedPhone,
      productTitle: productTitle || null,
      sourcePath: sourcePath || null,
    });

    const { data } = await sendAligoRelay({
      receiver: normalizedPhone,
      msg: message,
      relayExtras: {
        name,
        phone,
        product_title: productTitle || null,
        source_path: sourcePath || null,
        content: contentValue || "",
      },
    });

    console.log("[inquiries] aligo relay success", {
      inquiryId,
      data,
    });
  } catch (error) {
    console.error("[inquiries] failed to call aligo relay server", {
      inquiryId,
      error,
    });
  }
```

---

## [7] 로그 저장: `inquiry_message_logs` insert 및 스키마

### 7-1 Route 내 insert payload (`send-message/route.ts`)

위 [2] 절에 포함됨. 필드 요약:

| 컬럼 | 값 |
|------|-----|
| `inquiry_id` | URL `id` |
| `channel` | `"sms"` |
| `recipient_phone` | 정규화된 수신번호 |
| `message` | **relay에 보낸 본문과 동일** (`trim` 후 문자열, DB 컬럼명은 `message`) |
| `provider` | `"aligo_relay"` |
| `send_status` | `"success"` \| `"failed"` |
| `provider_response` | relay JSON 응답(또는 에러 시 객체)을 `jsonSafe` 또는 `{ raw: ... }` |
| `failure_reason` | 실패 시 문자열, 성공 시 DB null |
| `actor_name` | 요청 `actor_name` 또는 `"관리자"` |

`content`라는 컬럼명은 **사용하지 않음** (문의 본문은 `inquiries.content`에만 존재).

### 7-2 마이그레이션 스키마 (`supabase/migrations/20260420120000_create_inquiry_message_logs.sql`)

```sql
-- 문의별 SMS(알리고 relay) 발송 로그

CREATE TABLE IF NOT EXISTS public.inquiry_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'sms',
  recipient_phone text NOT NULL,
  message text NOT NULL,
  provider text NOT NULL DEFAULT 'aligo_relay',
  send_status text NOT NULL,
  provider_response jsonb NULL,
  failure_reason text NULL,
  actor_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_message_logs_send_status_check
    CHECK (send_status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_inquiry_message_logs_inquiry_created_at
  ON public.inquiry_message_logs (inquiry_id, created_at DESC);

COMMENT ON TABLE public.inquiry_message_logs IS '문의 관련 SMS 발송 이력(알리고 relay)';

ALTER TABLE public.inquiry_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read inquiry_message_logs" ON public.inquiry_message_logs;
CREATE POLICY "Allow public read inquiry_message_logs"
  ON public.inquiry_message_logs
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert inquiry_message_logs" ON public.inquiry_message_logs;
CREATE POLICY "Allow public insert inquiry_message_logs"
  ON public.inquiry_message_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

---

## 문서 메타

- 생성 목적: 관리자 문자 발송과 공개 문의 접수 문자의 **코드 경로 분리** 및 **fallback 개입 지점** 명확화.
- 소스 기준: 레포 내 해당 파일 내용 전체 발췌(본 문서 작성 시점 기준). 코드 변경 시 파일과 diff를 맞출 것.
