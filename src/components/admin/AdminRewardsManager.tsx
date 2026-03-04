"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Copy,
  Check,
  Truck,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

type Member = { id: string; name: string; username: string; email: string; phone: string };
type Catalog = { id: string; title: string; point_cost: number; stock: number | null };
type Row = {
  id: string;
  user_id: string;
  catalog_id: string;
  status: string;
  point_amount: number;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  admin_memo: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  reward_catalog: Catalog | null;
  members: Member | null;
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

const MESSAGE_TEMPLATES = [
  { label: "주소 확인 요청", key: "address" as const },
  { label: "발송 완료 안내(운송장 포함)", key: "shipping" as const },
];

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

export default function AdminRewardsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = searchParams.get("status") || "REQUESTED";
  const selectedId = searchParams.get("id");

  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminMemo, setAdminMemo] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [copiedContact, setCopiedContact] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const selected = selectedId ? list.find((r) => r.id === selectedId) : null;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rewards/redemptions?status=${status}`);
      const data = await res.json();
      if (res.ok) setList(Array.isArray(data) ? data : []);
      else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const runAction = useCallback(
    async (action: "approve" | "reject" | "ship" | "complete", id: string, body?: Record<string, unknown>) => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/admin/rewards/redemptions/${id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.message || "처리 실패");
          return;
        }
        setAdminMemo("");
        setRejectReason("");
        setTrackingCarrier("");
        setTrackingNumber("");
        await fetchList();
        if (action === "reject" || action === "complete") {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("id");
          router.replace(`${pathname}?${params.toString()}`);
        }
      } finally {
        setActionLoading(null);
      }
    },
    [status, fetchList, searchParams, pathname, router],
  );

  const copyContact = useCallback(() => {
    if (!selected) return;
    const text = [
      selected.shipping_name,
      selected.shipping_phone,
      [selected.shipping_address1, selected.shipping_address2].filter(Boolean).join(" "),
      selected.shipping_zip,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedContact(true);
      setTimeout(() => setCopiedContact(false), 2000);
    });
  }, [selected]);

  const buildTemplateBody = useCallback(
    (key: "address" | "shipping") => {
      if (!selected) return "";
      if (key === "address") {
        return "안녕하세요. 경품 배송을 위해 수령 주소를 확인하고자 연락드립니다. 현재 등록된 주소로 발송해도 될까요?";
      }
      const tracking = selected.tracking_number
        ? `\n운송장: ${selected.tracking_carrier ? `${selected.tracking_carrier} ` : ""}${selected.tracking_number}`
        : "";
      return `안녕하세요. 신청하신 경품 발송이 시작되었습니다.${tracking}\n수령까지 2~3일 정도 소요될 수 있습니다.`;
    },
    [selected],
  );

  const copyTemplate = useCallback((body: string) => {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedTemplate(body.slice(0, 20));
      setTimeout(() => setCopiedTemplate(null), 2000);
    });
  }, []);

  return (
    <div className="flex gap-6">
      <section className="min-w-0 flex-1 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">불러오는 중…</div>
        ) : list.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">해당 상태의 신청이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">신청일</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">회원</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">연락처</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">경품명</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">포인트</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">상태</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("id", r.id);
                      router.replace(`${pathname}?${params.toString()}`);
                    }}
                    className={`cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)] ${selectedId === r.id ? "bg-[var(--primary-soft)]" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{formatDate(r.requested_at)}</td>
                    <td className="px-4 py-3">{r.members?.name ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{(r.shipping_phone || r.members?.phone) ?? "-"}</td>
                    <td className="px-4 py-3">{r.reward_catalog?.title ?? "-"}</td>
                    <td className="px-4 py-3 font-medium text-[var(--primary)]">{Number(r.point_amount).toLocaleString()}P</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <aside className="w-[380px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">상세</h3>
          <p className="mt-1 text-sm text-[var(--primary)]">{selected.reward_catalog?.title} · {Number(selected.point_amount).toLocaleString()}P</p>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-[var(--text-muted)]">배송 정보</p>
              <p className="mt-0.5 text-[var(--text-primary)]">
                {selected.shipping_name} / {selected.shipping_phone}
                <br />
                {selected.shipping_address1}
                {selected.shipping_address2 ? ` ${selected.shipping_address2}` : ""}
                {selected.shipping_zip ? ` (${selected.shipping_zip})` : ""}
              </p>
            </div>
            {selected.user_message && (
              <div>
                <p className="font-medium text-[var(--text-muted)]">요청 메모</p>
                <p className="mt-0.5 text-[var(--text-primary)]">{selected.user_message}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
            >
              {copiedContact ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedContact ? "복사됨" : "연락처 복사"}
            </button>
            {MESSAGE_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => copyTemplate(buildTemplateBody(t.key))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
              >
                {copiedTemplate ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-[var(--text-muted)]">내부 메모 (admin_memo)</label>
            <textarea
              value={adminMemo}
              onChange={(e) => setAdminMemo(e.target.value)}
              placeholder="관리자만 보는 메모"
              className="input-base mt-1 w-full resize-none bg-[var(--surface-muted)]"
              rows={2}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {selected.status === "REQUESTED" && (
              <>
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => runAction("approve", selected.id, { admin_memo: adminMemo || undefined })}
                  className="btn-admin-primary inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  승인
                </button>
                <div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="반려 사유 (사용자 알림에 포함)"
                    className="input-base w-full bg-[var(--surface-muted)] text-sm"
                  />
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      runAction("reject", selected.id, {
                        admin_memo: adminMemo || undefined,
                        reason: rejectReason || undefined,
                      })
                    }
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-[var(--danger)] hover:opacity-90"
                  >
                    <XCircle className="h-4 w-4" />
                    반려
                  </button>
                </div>
              </>
            )}
            {(selected.status === "REQUESTED" || selected.status === "APPROVED") && (
              <>
                <input
                  type="text"
                  value={trackingCarrier}
                  onChange={(e) => setTrackingCarrier(e.target.value)}
                  placeholder="택배사"
                  className="input-base bg-[var(--surface-muted)] text-sm"
                />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="운송장 번호"
                  className="input-base bg-[var(--surface-muted)] text-sm"
                />
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() =>
                    runAction("ship", selected.id, {
                      tracking_carrier: trackingCarrier || undefined,
                      tracking_number: trackingNumber || undefined,
                      admin_memo: adminMemo || undefined,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Truck className="h-4 w-4" />
                  발송
                </button>
              </>
            )}
            {(selected.status === "SHIPPED" || selected.status === "APPROVED") && (
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => runAction("complete", selected.id, { admin_memo: adminMemo || undefined })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border)]"
              >
                <CheckCircle className="h-4 w-4" />
                완료
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
