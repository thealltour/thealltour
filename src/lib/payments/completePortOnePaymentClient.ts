/**
 * 브라우저에서 PortOne SDK 성공 직후 서버 확정 API 호출.
 */

export type CompletePortOnePaymentResult =
  | { ok: true; bookingId: string; bookingNumber?: string | null; alreadyProcessed?: boolean }
  | { ok: false; message: string; status?: number };

export async function completePortOnePaymentClient(
  paymentId: string,
): Promise<CompletePortOnePaymentResult> {
  const res = await fetch("/api/payments/portone/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    bookingId?: string;
    bookingNumber?: string | null;
    alreadyProcessed?: boolean;
  };

  if (!res.ok || !data.ok || !data.bookingId) {
    return {
      ok: false,
      message: data.message ?? "결제 확정에 실패했습니다.",
      status: res.status,
    };
  }

  return {
    ok: true,
    bookingId: data.bookingId,
    bookingNumber: data.bookingNumber,
    alreadyProcessed: data.alreadyProcessed,
  };
}
