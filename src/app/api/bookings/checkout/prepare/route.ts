import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPendingDepositBooking } from "@/lib/bookings/createPendingDepositBooking";
import { resolveCheckoutBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";
import { isPortOneEnabled } from "@/lib/payments/portone/config";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { normalizeDepartureSchedulesFromUnknown } from "@/lib/products/normalizeDepartureSchedules";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { findDepartureScheduleForYmd } from "@/lib/products/matchDepartureScheduleByYmd";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const customerSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().trim().min(8, "연락처를 입력해 주세요."),
  email: z.string().trim().email("이메일을 확인해 주세요."),
});

const bodySchema = z.object({
  product_id: z.string().min(1),
  product_title: z.string().optional(),
  source_path: z.string().optional(),
  departure: z.object({
    label: z.string().min(1),
    inquiryValue: z.string().min(1),
    ymd: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
  }),
  selected_options: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  points_use: z.number().int().min(0).optional(),
  traveler_count: z.number().int().min(1).max(99).optional(),
  /** PortOne paymentId (KG이니시스 40자 제한). 클라이언트가 prepare 직전 생성 */
  transaction_id: z.string().min(1).max(40).optional(),
  /** 주문서 예약자 — 회원/비회원 공통 필수 */
  customer: customerSchema,
});

function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "요청 형식이 올바르지 않습니다.";
  if (typeof issue.message === "string" && issue.message && issue.message !== "Required") {
    return issue.message;
  }
  return "요청 형식이 올바르지 않습니다.";
}

/**
 * 결제 준비 (회원·비회원 공용).
 * 세션이 있으면 member_id 연결, 없어도 customer 정보로 예약·결제 준비 가능.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    body = bodySchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: firstZodMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (!isPortOneEnabled()) {
    return NextResponse.json(
      { message: "결제 서비스가 일시 중단되었습니다. 상담 문의로 예약해 주세요." },
      { status: 503 },
    );
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, title, price, options, departure_schedules_json, product_line_id, category")
    .eq("id", body.product_id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const productLineId =
    typeof (product as { product_line_id?: string | null }).product_line_id === "string"
      ? String((product as { product_line_id: string }).product_line_id).trim()
      : "";

  let taxonomyNameMap: Record<string, string> = {};
  if (productLineId) {
    const { data: line } = await supabaseAdmin
      .from("product_taxonomies")
      .select("id, name")
      .eq("id", productLineId)
      .maybeSingle();
    if (line?.id && line?.name) {
      taxonomyNameMap = { [String(line.id)]: String(line.name) };
    }
  }

  const benefitMode = resolveCheckoutBenefitMode(
    {
      id: String(product.id),
      title: String(product.title ?? ""),
      category: (product as { category?: string | null }).category ?? null,
      product_line_id: productLineId || null,
    },
    taxonomyNameMap,
  );

  try {
    const schedules = normalizeDepartureSchedulesFromUnknown(product.departure_schedules_json);
    const departureYmd =
      normalizeProductDepartureDateToYmd(body.departure.ymd) ||
      normalizeProductDepartureDateToYmd(body.departure.inquiryValue) ||
      normalizeProductDepartureDateToYmd(body.departure.label) ||
      null;

    if (!departureYmd) {
      return NextResponse.json(
        { message: "출발일 형식이 올바르지 않습니다. 달력에서 출발일을 다시 선택해 주세요." },
        { status: 400 },
      );
    }

    const schedule = findDepartureScheduleForYmd(schedules, departureYmd);
    const returnRaw = schedule?.returnDate?.trim();
    const returnDate = returnRaw
      ? normalizeProductDepartureDateToYmd(returnRaw) ?? departureYmd
      : departureYmd;

    const result = await createPendingDepositBooking({
      memberId: session?.memberId ?? null,
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
      },
      productId: body.product_id,
      productTitle: body.product_title?.trim() || String(product.title ?? "상품"),
      sourcePath: body.source_path?.trim() || `/products/${body.product_id}`,
      departure: {
        ...body.departure,
        ymd: departureYmd,
      },
      selectedOptions: body.selected_options,
      options: (product.options as Record<string, unknown> | null)?.groups
        ? (product.options as import("@/types/product").ProductOptions)
        : undefined,
      productBasePrice: typeof product.price === "number" ? product.price : null,
      pointsUse: body.points_use,
      travelerCount: body.traveler_count,
      returnDate,
      benefitMode,
      transactionId: body.transaction_id,
    });

    return NextResponse.json({
      booking_id: result.booking_id,
      booking_number: result.booking_number,
      payment_id: result.payment_id,
      checkout_snapshot: result.checkout_snapshot,
      portone: result.portone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결제 준비에 실패했습니다.";
    console.error("[checkout/prepare]", message, error);
    if (message === "PORTONE_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: "결제 서비스가 아직 설정되지 않았습니다. 상담 문의로 예약해 주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
