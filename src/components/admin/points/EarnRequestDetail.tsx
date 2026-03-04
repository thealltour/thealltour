"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";

const TEMPLATE_CONFIRM = `안녕하세요.
더올투어 포인트 적립 요청 관련 안내드립니다.

제출해주신 예약 정보를 확인 중이며
추가 확인이 필요한 부분이 있어 연락드립니다.

아래 정보를 확인 후 회신 부탁드립니다.

* 예약번호
* 출발일
* 결제자명

증빙 자료가 추가로 필요할 수 있습니다.

확인되는 대로 포인트 적립 여부를 안내드리겠습니다.

감사합니다.

더올투어 드림`;

type Detail = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
  attachments: Array<{ id: string; file_url: string; file_name: string }>;
};

type Props = {
  detail: Detail | null;
  onReload: () => Promise<void> | void;
};

export default function EarnRequestDetail({ detail, onReload }: Props) {
  const [amount, setAmount] = useState("10000");
  const [grantStatus, setGrantStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [adminMemo, setAdminMemo] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const messageTemplates = useMemo(() => {
    const amountNum = Number(amount) || 0;
    return [
      { label: "확인 요청 메시지", text: TEMPLATE_CONFIRM },
      {
        label: "승인 안내 메시지",
        text:
          grantStatus === "CONFIRMED"
            ? `안녕하세요.
더올투어입니다.

회원님께서 요청하신 여행 예약 건이 확인되어
포인트가 정상 지급되었습니다.

지급 포인트
+${amountNum}P

마이페이지에서 확인하실 수 있습니다.

앞으로도 더올투어 이용 부탁드립니다.

감사합니다.`
            : `안녕하세요.
더올투어입니다.

회원님께서 요청하신 예약 건이 확인되어
포인트 지급이 등록되었습니다.

현재 포인트는 검수 단계로
확정 후 사용 가능 상태로 전환됩니다.

지급 예정 포인트
+${amountNum}P

확정 시 다시 안내드리겠습니다.

감사합니다.`,
      },
      {
        label: "반려 안내 메시지",
        text: `안녕하세요.
더올투어입니다.

회원님께서 요청하신 포인트 적립 요청에 대해
검수 결과 아래 사유로 처리가 어려운 점 안내드립니다.

반려 사유
${rejectReason || "{reject_reason}"}

추가 문의가 있으시면 언제든지 문의 부탁드립니다.

감사합니다.

더올투어 드림`,
      },
    ];
  }, [amount, grantStatus, rejectReason]);

  if (!detail) {
    return <p className="text-sm text-[var(--text-muted)]">요청을 선택하면 상세 정보가 표시됩니다.</p>;
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setMessage({ type: "ok", text: "메시지를 복사했습니다." });
  };

  const copyContact = async () => {
    const text = [detail.payer_name, detail.contact_phone, detail.members?.phone].filter(Boolean).join(" / ");
    await navigator.clipboard.writeText(text);
    setMessage({ type: "ok", text: "연락처를 복사했습니다." });
  };

  const approve = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/points/earn-requests/${detail.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          grant_status: grantStatus,
          admin_memo: adminMemo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "승인 처리 실패" });
        return;
      }
      setMessage({ type: "ok", text: data.message || "승인 완료" });
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/points/earn-requests/${detail.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reject_reason: rejectReason,
          admin_memo: adminMemo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "반려 처리 실패" });
        return;
      }
      setMessage({ type: "ok", text: data.message || "반려 완료" });
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">요청 상세</h3>
      <p className="text-sm text-[var(--text-secondary)]">예약번호: {detail.booking_ref}</p>
      <p className="text-sm text-[var(--text-secondary)]">출발일: {detail.departure_date}</p>
      <p className="text-sm text-[var(--text-secondary)]">결제자명: {detail.payer_name}</p>
      <p className="text-sm text-[var(--text-secondary)]">연락처: {detail.contact_phone ?? detail.members?.phone ?? "-"}</p>
      <p className="text-sm text-[var(--text-secondary)]">요청 메모: {detail.memo ?? "-"}</p>
      <button
        type="button"
        onClick={copyContact}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)]"
      >
        <Copy className="h-3.5 w-3.5" />
        연락처 복사
      </button>

      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--text-muted)]">증빙 파일</p>
        {detail.attachments.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">첨부 파일 없음</p>
        ) : (
          detail.attachments.map((file) => (
            <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="block text-xs text-[var(--primary)] underline">
              {file.file_name}
            </a>
          ))
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">승인</p>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="amount"
          className="input-base w-full bg-[var(--surface-muted)]"
        />
        <select
          value={grantStatus}
          onChange={(e) => setGrantStatus(e.target.value as "CONFIRMED" | "PENDING")}
          className="input-base w-full bg-[var(--surface-muted)]"
        >
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PENDING">PENDING</option>
        </select>
        <textarea
          value={adminMemo}
          onChange={(e) => setAdminMemo(e.target.value)}
          placeholder="admin_memo"
          rows={2}
          className="input-base w-full resize-none bg-[var(--surface-muted)]"
        />
        <button
          type="button"
          disabled={loading || detail.status !== "REQUESTED"}
          onClick={approve}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          승인
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">반려</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="reject_reason"
          rows={2}
          className="input-base w-full resize-none bg-[var(--surface-muted)]"
        />
        <button
          type="button"
          disabled={loading || detail.status !== "REQUESTED" || !rejectReason.trim()}
          onClick={reject}
          className="rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
        >
          반려
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">메시지 템플릿 복사</p>
        {messageTemplates.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => copy(item.text)}
            className="block w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-left text-xs text-[var(--text-primary)]"
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className={message.type === "ok" ? "text-xs text-[var(--success)]" : "text-xs text-[var(--danger)]"}>
          {message.text}
        </p>
      ) : null}
    </aside>
  );
}
