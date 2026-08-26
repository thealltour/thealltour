"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageCardSkeleton } from "@/components/mypage/ui/MyPageSkeleton";
import { PortOneCheckoutButton } from "@/components/payments/PortOneCheckoutButton";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { CheckoutSnapshot } from "@/types/checkout";
import type { BookingPaymentRow } from "@/types/travelBooking";

type BookingDetail = {
  id: string;
  booking_number: string;
  booking_status: string;
  product_title: string | null;
  traveler_count: number;
  departure_date: string | null;
  return_date: string | null;
  payment_status: string;
  payment_paid_amount: number;
  payment_total_amount: number | null;
  checkout_snapshot: CheckoutSnapshot | null;
  balance_payment_preference: string | null;
  cash_receipt_requested: boolean;
  local_perks_matched: boolean;
  payments: BookingPaymentRow[];
};

export type MyPageBookingDetailClientProps = {
  portOneEnabled: boolean;
};

export default function MyPageBookingDetailClient({
  portOneEnabled,
}: MyPageBookingDetailClientProps) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const bookingId = params.id;
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cashReceiptOn, setCashReceiptOn] = useState(true);
  const [portoneParams, setPortoneParams] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const redirectCompleteRef = useRef<string | null>(null);

  const depositSuccess = searchParams.get("deposit") === "1";
  const paidSuccess = searchParams.get("paid") === "1";
  const balanceSuccess = searchParams.get("balance") === "1";
  const paymentReturnSuccess = depositSuccess || paidSuccess;
  const redirectPaymentId = searchParams.get("paymentId")?.trim() || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/bookings/${encodeURIComponent(bookingId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "예약을 불러올 수 없습니다.");
        return;
      }
      const row = data as BookingDetail;
      setDetail(row);
      setCashReceiptOn(
        !portOneEnabled || row.balance_payment_preference !== "portone",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, portOneEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!redirectPaymentId || (!paymentReturnSuccess && !balanceSuccess)) return;
    if (redirectCompleteRef.current === redirectPaymentId) return;
    redirectCompleteRef.current = redirectPaymentId;
    let cancelled = false;
    void (async () => {
      const result = await completePortOnePaymentClient(redirectPaymentId);
      if (cancelled) return;
      if (!result.ok) {
        setMessage(
          result.message ||
            "결제는 완료됐을 수 있습니다. 잠시 후 예약 상태를 확인해 주세요.",
        );
      }
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [redirectPaymentId, paymentReturnSuccess, balanceSuccess, load]);

  const snapshot = detail?.checkout_snapshot;
  const balanceDue = snapshot?.balanceDue ?? 0;
  const depositPaid = (detail?.payments ?? []).some(
    (p) => p.status === "confirmed" && (p as BookingPaymentRow & { payment_kind?: string }).payment_kind !== "balance",
  );
  const showBalanceSection =
    detail &&
    detail.payment_status !== "paid" &&
    detail.booking_status !== "canceled" &&
    balanceDue > 0 &&
    depositPaid;

  const saveBalancePreference = async (mode: "cash_receipt" | "portone") => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/me/bookings/${encodeURIComponent(bookingId)}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "저장에 실패했습니다.");
        return;
      }
      if (mode === "portone" && data.portone) {
        setPortoneParams(data.portone as Record<string, unknown>);
      } else {
        setPortoneParams(null);
      }
      setMessage(data.message ?? "저장되었습니다.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/mypage/bookings" className="link-primary font-medium">
          ← 내 예약 목록
        </Link>
      </p>

      {paymentReturnSuccess ? (
        <p className="mb-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {paidSuccess
            ? "결제가 접수되었습니다. 예약 내역을 확인해 주세요."
            : "예약금 결제가 접수되었습니다. 잔금 결제 방법을 선택해 주세요."}
        </p>
      ) : null}

      {loading ? (
        <MyPageCardSkeleton />
      ) : !detail ? (
        <p className="text-sm text-[var(--danger)]">{message || "예약을 찾을 수 없습니다."}</p>
      ) : (
        <div className="space-y-6">
          <MyPageCard>
            <h2 className="text-lg font-semibold text-[var(--primary)]">{detail.booking_number}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {detail.product_title ?? "상품명 미등록"}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">일정</dt>
                <dd>
                  {detail.departure_date ?? "—"} ~ {detail.return_date ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">인원</dt>
                <dd>{detail.traveler_count}명</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">결제 상태</dt>
                <dd>{detail.payment_status}</dd>
              </div>
              {snapshot ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-muted)]">견적 합계</dt>
                    <dd>{formatPriceKR(snapshot.quoteTotal)}</dd>
                  </div>
                  {snapshot.pointsUseRequested > 0 ? (
                    <div className="flex justify-between text-[var(--primary)]">
                      <dt>포인트</dt>
                      <dd>-{snapshot.pointsUseRequested.toLocaleString("ko-KR")}P</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-muted)]">잔금</dt>
                    <dd className="font-semibold">{formatPriceKR(snapshot.balanceDue)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </MyPageCard>

          {snapshot?.departure ? (
            <MyPageCard title="선택 출발일">
              <p className="text-sm text-[var(--text-primary)]">{snapshot.departure.label}</p>
            </MyPageCard>
          ) : null}

          {showBalanceSection ? (
            <MyPageCard title="잔금 결제">
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                잔금 {formatPriceKR(balanceDue)} — 기본은 현금+현금영수증(현지 특전)입니다.
              </p>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3">
                <input
                  type="checkbox"
                  checked={cashReceiptOn}
                  onChange={(e) => setCashReceiptOn(e.target.checked)}
                  disabled={!portOneEnabled}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium">현금 결제 + 현금영수증 발행</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                    현지 특전 자동 매칭
                  </span>
                </span>
              </label>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {cashReceiptOn ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveBalancePreference("cash_receipt")}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
                  >
                    현금+현금영수증으로 확정
                  </button>
                ) : portOneEnabled && portoneParams &&
                  typeof portoneParams.storeId === "string" &&
                  typeof portoneParams.channelKey === "string" &&
                  typeof portoneParams.paymentId === "string" ? (
                  <PortOneCheckoutButton
                    params={{
                      storeId: portoneParams.storeId,
                      channelKey: portoneParams.channelKey,
                      paymentId: portoneParams.paymentId,
                      orderName: String(portoneParams.orderName ?? "잔금"),
                      totalAmount: Number(portoneParams.totalAmount ?? balanceDue),
                      currency: "CURRENCY_KRW",
                      redirectUrl: `${window.location.origin}/mypage/bookings/${bookingId}?balance=1`,
                    }}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)]"
                    onSuccess={(paymentId) => {
                      void (async () => {
                        const result = await completePortOnePaymentClient(paymentId);
                        if (!result.ok) {
                          setMessage(
                            result.message ||
                              "결제는 완료됐을 수 있습니다. 화면을 새로고침해 확인해 주세요.",
                          );
                        }
                        await load();
                      })();
                    }}
                    onError={(err) => setMessage(err)}
                  >
                    카드·간편결제로 잔금 {formatPriceKR(balanceDue)} 결제
                  </PortOneCheckoutButton>
                ) : portOneEnabled ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveBalancePreference("portone")}
                    className="rounded-lg border border-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary)] disabled:opacity-60"
                  >
                    카드·간편결제로 잔금 결제
                  </button>
                ) : null}
              </div>

              {portOneEnabled && !cashReceiptOn ? (
                <button
                  type="button"
                  onClick={() => setCashReceiptOn(true)}
                  className="mt-3 text-xs text-[var(--text-muted)] underline"
                >
                  현금+현금영수증으로 돌아가기
                </button>
              ) : portOneEnabled ? (
                <button
                  type="button"
                  onClick={() => setCashReceiptOn(false)}
                  className="mt-3 text-xs text-[var(--primary)] underline"
                >
                  카드·간편결제로 잔금 결제
                </button>
              ) : null}
            </MyPageCard>
          ) : null}

          {detail.local_perks_matched ? (
            <p className="rounded-xl border border-[var(--success)]/30 bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
              현지 특전 매칭이 적용되었습니다.
            </p>
          ) : null}

          {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
        </div>
      )}
    </>
  );
}
