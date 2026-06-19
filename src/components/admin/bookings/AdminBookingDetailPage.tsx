"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BookingPaymentRow, BookingTravelerRow } from "@/types/travelBooking";

type BookingDetail = {
  id: string;
  booking_number: string;
  booking_status: string;
  product_title: string | null;
  traveler_count: number;
  payer_name: string | null;
  primary_traveler_phone: string | null;
  payment_status: string;
  payment_method: string | null;
  payment_total_amount: number | null;
  payment_paid_amount: number;
  departure_date: string | null;
  return_date: string | null;
  inquiry_id: string | null;
  member_id: string | null;
  booking_confirmed_sms_sent_at: string | null;
  trip_completed_sms_sent_at: string | null;
  travelers: BookingTravelerRow[];
  payments: BookingPaymentRow[];
  inquiry?: { id: number; name?: string; phone?: string; product_title?: string } | null;
  member?: { id: string; name?: string; email?: string; phone?: string } | null;
};

export default function AdminBookingDetailPage({ bookingId }: { bookingId: string }) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMemo, setPayMemo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "예약을 불러올 수 없습니다.");
        return;
      }
      setDetail(data as BookingDetail);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = async (path: string, body?: Record<string, unknown>) => {
    setMessage("");
    const res = await fetch(`/api/admin/bookings/${bookingId}${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setMessage(data.message ?? (res.ok ? "완료" : "실패"));
    if (res.ok) await load();
  };

  if (loading) return <p className="p-6 text-sm text-[var(--text-muted)]">불러오는 중…</p>;
  if (!detail) return <p className="p-6 text-sm text-[var(--danger)]">{message || "예약을 찾을 수 없습니다."}</p>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            <Link href="/theall_manager_only/bookings" className="hover:underline">
              ← 예약 목록
            </Link>
          </p>
          <h2 className="mt-1 text-xl font-bold">{detail.booking_number}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{detail.product_title ?? "상품 미지정"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.booking_status === "reserved" ? (
            <>
              <button type="button" onClick={() => void action("/confirm")} className="rounded-lg border px-3 py-2 text-sm">
                확정 SMS 재발송
              </button>
              <button
                type="button"
                onClick={() => void action("/complete")}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
              >
                여행 완료
              </button>
            </>
          ) : null}
          {detail.booking_status === "completed" ? (
            <button type="button" onClick={() => void action("/grant-reward")} className="rounded-lg border px-3 py-2 text-sm">
              리워드 지급
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">예약 정보</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">상태</dt><dd>{detail.booking_status}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">일정</dt><dd>{detail.departure_date} ~ {detail.return_date}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">인원</dt><dd>{detail.traveler_count}명</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">결제자</dt><dd>{detail.payer_name}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">연락처</dt><dd>{detail.primary_traveler_phone}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">결제</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">상태</dt><dd>{detail.payment_status}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">수단</dt><dd>{detail.payment_method ?? "—"}</dd></div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">금액</dt>
              <dd>{Number(detail.payment_paid_amount).toLocaleString()} / {Number(detail.payment_total_amount ?? 0).toLocaleString()}원</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="입금액" className="input-base flex-1" type="number" />
            <input value={payMemo} onChange={(e) => setPayMemo(e.target.value)} placeholder="메모" className="input-base flex-1" />
            <button
              type="button"
              onClick={() => void action("/payments", { amount: Number(payAmount), admin_memo: payMemo })}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              기록
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h3 className="font-semibold">여행자</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--text-muted)]">
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">이름</th>
                <th className="px-2 py-1 text-left">연락처</th>
                <th className="px-2 py-1 text-left">여권</th>
              </tr>
            </thead>
            <tbody>
              {detail.travelers.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]/60">
                  <td className="px-2 py-2">{t.sort_order}</td>
                  <td className="px-2 py-2">{t.full_name}{t.is_primary ? " (대표)" : ""}</td>
                  <td className="px-2 py-2">{t.phone ?? "—"}</td>
                  <td className="px-2 py-2">{t.passport_number ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {detail.inquiry ? (
          <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
            <h3 className="font-semibold">연결 문의</h3>
            <p className="mt-2">
              <Link href={`/theall_manager_only/inquiries?id=${detail.inquiry.id}`} className="text-[var(--primary)] hover:underline">
                문의 #{detail.inquiry.id}
              </Link>
              {" · "}{detail.inquiry.name}
            </p>
          </div>
        ) : null}
        {detail.member ? (
          <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
            <h3 className="font-semibold">연결 회원</h3>
            <p className="mt-2">
              <Link href={`/theall_manager_only/members/${detail.member.id}`} className="text-[var(--primary)] hover:underline">
                {detail.member.name}
              </Link>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
