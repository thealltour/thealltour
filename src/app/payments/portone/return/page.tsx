"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/Button";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";
import {
  trackPaymentReturnFailed,
  trackPaymentReturnView,
} from "@/lib/analytics/trackPaymentReturnEvents";
import { cn } from "@/lib/cn";

type ReturnStatus = "checking" | "failed";

/**
 * PortOne 모바일/리다이렉트 결제 복귀.
 * query의 paymentId로 서버 확정(금액·PAID 검증) 후 완료 페이지로 이동.
 * 미확인/실패 시에는 안전한 복귀 CTA만 제공한다 (Payment Core 변경 없음).
 */
function PortOneReturnInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ranRef = useRef(false);
  const viewTrackedRef = useRef(false);
  const failedTrackedRef = useRef(false);
  const [status, setStatus] = useState<ReturnStatus>("checking");
  const [message, setMessage] = useState("결제 내역을 확인하고 있습니다…");

  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    trackPaymentReturnView();
  }, []);

  useEffect(() => {
    if (ranRef.current) return;
    const paymentId =
      searchParams.get("paymentId")?.trim() ||
      searchParams.get("payment_id")?.trim() ||
      "";
    if (!paymentId) {
      setMessage("결제 식별자를 찾을 수 없습니다. 예약 내역에서 상태를 확인해 주세요.");
      setStatus("failed");
      if (!failedTrackedRef.current) {
        failedTrackedRef.current = true;
        trackPaymentReturnFailed({ reason: "missing_payment_id", hasPaymentId: false });
      }
      return;
    }
    ranRef.current = true;

    void (async () => {
      const result = await completePortOnePaymentClient(paymentId);
      if (!result.ok) {
        setMessage(result.message || "결제 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setStatus("failed");
        if (!failedTrackedRef.current) {
          failedTrackedRef.current = true;
          trackPaymentReturnFailed({ reason: "complete_failed", hasPaymentId: true });
        }
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
      <p className="text-sm font-medium text-slate-800 whitespace-pre-line">{message}</p>

      {status === "checking" ? (
        <p className="mt-2 text-xs text-slate-500">
          결제가 확인되는 동안 잠시만 기다려 주세요.
        </p>
      ) : null}

      {status === "failed" ? (
        <div className="mt-6 flex w-full flex-col items-stretch gap-3">
          <p className="text-xs leading-relaxed text-slate-500">
            결제를 완료하지 않으셨거나 다시 진행하려면
            <br />
            상품 목록에서 예약을 다시 시작해 주세요.
          </p>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "accent", size: "md" }), "w-full")}
          >
            상품 목록으로 돌아가기
          </Link>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
          >
            홈으로 가기
          </Link>
        </div>
      ) : null}
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
