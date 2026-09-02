"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageCardSkeleton } from "@/components/mypage/ui/MyPageSkeleton";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { CheckoutSnapshot } from "@/types/checkout";

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
  local_perks_matched: boolean;
};

export default function MyPageBookingDetailClient() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const bookingId = params.id;
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const redirectCompleteRef = useRef<string | null>(null);

  const paidSuccess = searchParams.get("paid") === "1" || searchParams.get("deposit") === "1";
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
      setDetail(data as BookingDetail);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!redirectPaymentId || !paidSuccess) return;
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
  }, [redirectPaymentId, paidSuccess, load]);

  const snapshot = detail?.checkout_snapshot;

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/mypage/bookings" className="link-primary font-medium">
          ← 내 예약 목록
        </Link>
      </p>

      {paidSuccess ? (
        <p className="mb-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          결제가 접수되었습니다. 예약 내역을 확인해 주세요.
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
                </>
              ) : null}
            </dl>
          </MyPageCard>

          {snapshot?.departure ? (
            <MyPageCard title="선택 출발일">
              <p className="text-sm text-[var(--text-primary)]">{snapshot.departure.label}</p>
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
