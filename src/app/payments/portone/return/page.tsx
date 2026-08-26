"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";

/**
 * PortOne 모바일/리다이렉트 결제 복귀.
 * query의 paymentId로 서버 확정(금액·PAID 검증) 후 완료 페이지로 이동.
 */
function PortOneReturnInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ranRef = useRef(false);
  const [message, setMessage] = useState("결제 내역을 확인하고 있습니다…");

  useEffect(() => {
    if (ranRef.current) return;
    const paymentId =
      searchParams.get("paymentId")?.trim() ||
      searchParams.get("payment_id")?.trim() ||
      "";
    if (!paymentId) {
      setMessage("결제 식별자를 찾을 수 없습니다. 예약 내역에서 상태를 확인해 주세요.");
      return;
    }
    ranRef.current = true;

    void (async () => {
      const result = await completePortOnePaymentClient(paymentId);
      if (!result.ok) {
        setMessage(result.message || "결제 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const q = new URLSearchParams();
      if (result.bookingNumber) q.set("bookingNumber", result.bookingNumber);
      if (result.bookingId) q.set("bookingId", result.bookingId);
      router.replace(`/order/success?${q.toString()}`);
    })();
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-sm font-medium text-slate-800">{message}</p>
      <p className="mt-2 text-xs text-slate-500">창을 닫지 말고 잠시만 기다려 주세요.</p>
    </main>
  );
}

export default function PortOneReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[50vh] items-center justify-center px-5 text-sm text-slate-600">
          결제 확인 준비 중…
        </main>
      }
    >
      <PortOneReturnInner />
    </Suspense>
  );
}
