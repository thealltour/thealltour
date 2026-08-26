import type { BookingPaymentPayload } from "@/lib/payments/bookingPaymentPayload";

export type SubmitPaymentResult = { ok: true } | { ok: false; message: string };

/**
 * PG 비의존 결제 진입점.
 *
 * Mock 단계: 콘솔 + 브라우저 alert로 성공 시뮬레이션.
 * PG 확정 후 이 함수 본문만 Toss / PortOne 실호출로 교체하면 된다.
 *
 * --- Toss 연결 지점 (예시) ---
 * // const toss = await loadTossPayments(clientKey);
 * // await toss.requestPayment({ amount: payload.payAmount, orderId: payload.orderId, ... });
 *
 * --- PortOne 연결 지점 ---
 * // return submitPaymentPortOne(payload); // → submitPayment.portone.ts
 *
 * Mock에서는 `/api/bookings/checkout/prepare` 를 호출하지 않는다.
 * 로그인 강제도 Mock에서는 하지 않는다 (REQUIRE_LOGIN_FOR_PAYMENT = false).
 */
export const REQUIRE_LOGIN_FOR_PAYMENT = false;

export async function submitPayment(
  payload: BookingPaymentPayload,
): Promise<SubmitPaymentResult> {
  // eslint-disable-next-line no-console -- Mock 결제 디버그
  console.log("[submitPayment:mock]", payload);

  if (typeof window !== "undefined") {
    const typeLabel = payload.paymentType === "deposit" ? "예약금" : "전액";
    window.alert(
      [
        "[Mock 결제 성공]",
        `주문번호: ${payload.orderId}`,
        `상품: ${payload.productName}`,
        `방식: ${typeLabel}`,
        `결제금액: ${payload.payAmount.toLocaleString("ko-KR")}원`,
        payload.remainingBalance > 0
          ? `잔금: ${payload.remainingBalance.toLocaleString("ko-KR")}원`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { ok: true };
}

/**
 * PortOne prepare + SDK 호출 스텁.
 * PG 확정 시 submitPayment에서 이 경로로 위임하면 된다.
 * (현재 Mock 경로에서는 호출하지 않음)
 */
export async function submitPaymentPortOneStub(
  _payload: BookingPaymentPayload,
): Promise<SubmitPaymentResult> {
  return {
    ok: false,
    message: "PortOne 결제는 아직 연결되지 않았습니다. submitPayment Mock을 사용하세요.",
  };
}
