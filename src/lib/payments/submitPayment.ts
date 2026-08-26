import type { BookingPaymentPayload } from "@/lib/payments/bookingPaymentPayload";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";

export type SubmitPaymentResult =
  | { ok: true; bookingId: string; bookingNumber?: string | null }
  | { ok: false; message: string; needLogin?: boolean };

/**
 * 상품상세 간편결제 → PortOne V2 인증결제.
 * prepare → requestPayment → complete.
 */
export const REQUIRE_LOGIN_FOR_PAYMENT = true;

type PrepareResponse = {
  booking_id: string;
  booking_number?: string;
  portone: {
    storeId: string;
    channelKey: string;
    paymentId: string;
    orderName: string;
    totalAmount: number;
    currency?: "CURRENCY_KRW";
  };
};

export async function submitPayment(
  payload: BookingPaymentPayload,
): Promise<SubmitPaymentResult> {
  if (typeof window === "undefined") {
    return { ok: false, message: "브라우저에서만 결제를 진행할 수 있습니다." };
  }

  if (!payload.departure?.label || !payload.departure?.inquiryValue) {
    return { ok: false, message: "출발일을 선택해 주세요." };
  }

  const prepareRes = await fetch("/api/bookings/checkout/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: payload.productId,
      product_title: payload.productName,
      source_path: `/products/${payload.productId}`,
      departure: {
        label: payload.departure.label,
        inquiryValue: payload.departure.inquiryValue,
        price: payload.departure.price ?? null,
      },
      selected_options: payload.selectedOptionsMap ?? {},
      traveler_count: payload.headcount,
      payment_type: payload.paymentType,
    }),
  });

  const prepareData = (await prepareRes.json().catch(() => ({}))) as PrepareResponse & {
    message?: string;
  };

  if (prepareRes.status === 401) {
    return {
      ok: false,
      needLogin: true,
      message: prepareData.message ?? "로그인이 필요합니다.",
    };
  }

  if (!prepareRes.ok || !prepareData.portone?.paymentId) {
    return {
      ok: false,
      message: prepareData.message ?? "결제 준비에 실패했습니다.",
    };
  }

  const { portone, booking_id: bookingId } = prepareData;
  const PortOne = await import("@portone/browser-sdk/v2");
  const response = await PortOne.requestPayment({
    storeId: portone.storeId,
    channelKey: portone.channelKey,
    paymentId: portone.paymentId,
    orderName: portone.orderName,
    totalAmount: portone.totalAmount,
    currency: portone.currency ?? "CURRENCY_KRW",
    payMethod: "CARD",
    redirectUrl: `${window.location.origin}/mypage/bookings/${bookingId}?paid=1`,
  });

  if (response?.code != null) {
    return {
      ok: false,
      message: response.message ?? "결제가 취소되었습니다.",
    };
  }

  const completed = await completePortOnePaymentClient(portone.paymentId);
  if (!completed.ok) {
    // 결제는 됐을 수 있으므로 마이페이지로 유도할 bookingId는 반환
    return {
      ok: true,
      bookingId,
      bookingNumber: prepareData.booking_number,
    };
  }

  return {
    ok: true,
    bookingId: completed.bookingId,
    bookingNumber: completed.bookingNumber ?? prepareData.booking_number,
  };
}
