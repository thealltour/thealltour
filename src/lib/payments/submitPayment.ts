import type { BookingPaymentPayload } from "@/lib/payments/bookingPaymentPayload";
import { completePortOnePaymentClient } from "@/lib/payments/completePortOnePaymentClient";
import { createPortOneTransactionId } from "@/lib/payments/portone/createPortOneTransactionId";
import { resolveCheckoutDepartureYmd } from "@/lib/payments/resolveCheckoutDepartureYmd";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";

export type SubmitPaymentResult =
  | {
      ok: true;
      bookingId?: string;
      bookingNumber?: string | null;
      paymentId?: string;
    }
  | { ok: false; message: string; needLogin?: boolean };

export type SubmitPaymentPhase = "prepare" | "widget" | "confirm";

export type SubmitPaymentOptions = {
  /** UI 단계 표시용 (결제창 열기 / 서버 검증) */
  onPhase?: (phase: SubmitPaymentPhase) => void;
};

type PrepareResponse = {
  message?: string;
  booking_id?: string;
  booking_number?: string | null;
  portone?: {
    storeId: string;
    channelKey: string;
    paymentId: string;
    orderName: string;
    totalAmount: number;
    currency?: "CURRENCY_KRW";
  };
};

/**
 * PortOne V2 결제 진입점.
 * 1) prepare API로 pending 예약·paymentId 생성 (회원/비회원 공용)
 * 2) 브라우저 SDK requestPayment
 * 3) complete API로 서버 확정
 */
export const REQUIRE_LOGIN_FOR_PAYMENT = false;

export async function submitPayment(
  payload: BookingPaymentPayload,
  options?: SubmitPaymentOptions,
): Promise<SubmitPaymentResult> {
  if (typeof window === "undefined") {
    return { ok: false, message: "브라우저에서만 결제가 가능합니다." };
  }

  options?.onPhase?.("prepare");

  const departureYmd =
    resolveCheckoutDepartureYmd({
      selectedDeparture: {
        label: payload.departure.label,
        inquiryValue: payload.departure.inquiryValue,
        ymd: payload.departure.ymd,
        price: payload.departure.price,
      },
    }) ||
    normalizeProductDepartureDateToYmd(payload.departure.ymd) ||
    normalizeProductDepartureDateToYmd(payload.selectedDate) ||
    normalizeProductDepartureDateToYmd(payload.departure.inquiryValue) ||
    normalizeProductDepartureDateToYmd(payload.departure.label) ||
    null;

  if (!departureYmd) {
    return {
      ok: false,
      message: "출발일 형식이 올바르지 않습니다. 달력에서 출발일을 다시 선택해 주세요.",
    };
  }

  let prepareRes: Response;
  const transactionId = createPortOneTransactionId("full");
  try {
    prepareRes = await fetch("/api/bookings/checkout/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        product_id: payload.productId,
        product_title: payload.productName,
        source_path: `/products/${payload.productId}`,
        transaction_id: transactionId,
        departure: {
          label: payload.departure.label || departureYmd,
          inquiryValue: payload.departure.inquiryValue || payload.selectedDate || departureYmd,
          ymd: departureYmd,
          price: payload.departure.price ?? null,
        },
        selected_options: payload.selectedOptionsMap ?? {},
        traveler_count: payload.headcount,
        customer: {
          name: payload.customer.name,
          phone: payload.customer.phone,
          email: payload.customer.email,
        },
      }),
    });
  } catch {
    return { ok: false, message: "결제 준비 요청에 실패했습니다. 네트워크를 확인해 주세요." };
  }

  const prepareData = (await prepareRes.json().catch(() => ({}))) as PrepareResponse;
  if (!prepareRes.ok || !prepareData.portone) {
    return {
      ok: false,
      message: prepareData.message ?? "결제 준비에 실패했습니다.",
      needLogin: prepareRes.status === 401,
    };
  }

  const { portone } = prepareData;
  if (portone.paymentId !== transactionId) {
    return {
      ok: false,
      message: "결제 식별자가 일치하지 않습니다. 다시 시도해 주세요.",
    };
  }
  const storeId =
    portone.storeId ||
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ||
    "";
  const channelKey =
    portone.channelKey ||
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() ||
    "";

  if (!storeId || !channelKey) {
    return {
      ok: false,
      message: "PortOne 가맹점 설정이 없습니다. 환경변수를 확인해 주세요.",
    };
  }

  try {
    options?.onPhase?.("widget");
    const PortOne = await import("@portone/browser-sdk/v2");
    const response = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId: portone.paymentId,
      orderName: portone.orderName,
      totalAmount: portone.totalAmount,
      currency: portone.currency ?? "CURRENCY_KRW",
      payMethod: "CARD",
      customData: {
        productId: payload.productId,
        bookingId: prepareData.booking_id ?? null,
      },
      customer: {
        fullName: payload.customer.name,
        phoneNumber: payload.customer.phone.replace(/\D/g, ""),
        email: payload.customer.email,
      },
      // 모바일 등 리다이렉트 시 서버 검증 페이지로 복귀
      redirectUrl: `${window.location.origin}/payments/portone/return`,
    });

    if (response?.code != null) {
      return {
        ok: false,
        message: response.message ?? "결제가 취소되었거나 실패했습니다.",
      };
    }

    // 서버가 PortOne API로 PAID·금액 일치 검증 후 DB 확정
    options?.onPhase?.("confirm");
    const complete = await completePortOnePaymentClient(portone.paymentId);
    if (!complete.ok) {
      return { ok: false, message: complete.message };
    }

    return {
      ok: true,
      bookingId: complete.bookingId,
      bookingNumber: complete.bookingNumber ?? prepareData.booking_number,
      paymentId: portone.paymentId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "결제 요청에 실패했습니다.",
    };
  }
}
