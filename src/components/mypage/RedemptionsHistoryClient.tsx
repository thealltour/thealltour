"use client";

import { useState, useCallback } from "react";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

const STATUS_COLOR: Record<string, string> = {
  REQUESTED: "bg-[var(--warning-bg)] text-[var(--warning)]",
  APPROVED: "bg-[var(--primary-soft)] text-[var(--primary)]",
  REJECTED: "bg-[var(--danger-bg)] text-[var(--danger)]",
  SHIPPED: "bg-[var(--success-bg)] text-[var(--success)]",
  COMPLETED: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  CANCELED: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

type Redemption = {
  id: string;
  catalog_id: string;
  catalog_title?: string | null;
  point_amount: number;
  status: string;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  admin_memo?: string | null;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

type Props = {
  redemptions: Redemption[];
  notifications: Notification[];
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TrackingLink({ carrier, number }: { carrier: string | null; number: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = [carrier, number].filter(Boolean).join(" ");
  const cjUrl =
    number && /^\d{10,14}$/.test(number.replace(/\s/g, ""))
      ? `https://www.cjlogistics.com/ko/tool/parcel/tracking?paramInvcNo=${number}`
      : null;

  const copy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  if (!text) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {cjUrl ? (
        <a
          href={cjUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          운송장 조회
        </a>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--border)]"
      >
        {copied ? "복사됨" : "운송장 번호 복사"}
      </button>
    </div>
  );
}

export default function RedemptionsHistoryClient({ redemptions, notifications }: Props) {
  if (redemptions.length === 0 && notifications.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">교환 신청 내역과 알림이 없습니다.</p>;
  }

  return (
    <div className="space-y-8">
      {redemptions.length > 0 && (
        <ul className="space-y-6">
          {redemptions.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{r.catalog_title ?? "경품"}</p>
                  <p className="text-sm text-[var(--primary)]">{Number(r.point_amount).toLocaleString()}P</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>

              {/* 타임라인 */}
              <div className="mt-4 space-y-1 text-xs text-[var(--text-muted)]">
                <p>신청 · {formatDate(r.requested_at)}</p>
                {r.decided_at && <p>처리 · {formatDate(r.decided_at)}</p>}
                {r.shipped_at && <p>발송 · {formatDate(r.shipped_at)}</p>}
                {r.completed_at && <p>완료 · {formatDate(r.completed_at)}</p>}
              </div>

              {r.tracking_carrier || r.tracking_number ? (
                <TrackingLink carrier={r.tracking_carrier} number={r.tracking_number} />
              ) : null}

              {r.admin_memo && (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                  <p className="font-medium text-[var(--text-secondary)]">관리자 메시지</p>
                  <p className="mt-1 text-[var(--text-primary)]">{r.admin_memo}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {notifications.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">최근 알림</h3>
          <ul className="space-y-2">
            {notifications.slice(0, 15).map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border border-[var(--border)] p-3 text-sm ${!n.is_read ? "bg-[var(--primary-soft)]" : "bg-[var(--surface-muted)]"}`}
              >
                <p className="font-medium text-[var(--text-primary)]">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[var(--text-secondary)]">{n.body}</p>}
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
