import { NextResponse } from "next/server";

/** PG webhook placeholder — 실제 PG 연동 시 provider별 서명 검증 후 booking_payments 반영 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid payload" }, { status: 400 });
  }

  console.info("[payment webhook stub]", provider, body);
  return NextResponse.json({
    ok: true,
    provider,
    message: "Webhook stub — PG 연동 시 booking_payments 및 payment_status를 업데이트합니다.",
  });
}
