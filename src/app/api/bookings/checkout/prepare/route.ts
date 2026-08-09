import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMemberSession } from "@/lib/apiAuth";
import { createPendingDepositBooking } from "@/lib/bookings/createPendingDepositBooking";
import { resolveCheckoutBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";
import { isPortOneEnabled } from "@/lib/payments/portone/config";
import { normalizeDepartureSchedulesFromUnknown } from "@/lib/products/normalizeDepartureSchedules";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { findDepartureScheduleForYmd } from "@/lib/products/matchDepartureScheduleByYmd";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
});

export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    body = bodySchema.parse(json);
  } catch {
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
      body.departure.ymd?.trim() ||
      normalizeProductDepartureDateToYmd(body.departure.inquiryValue) ||
      undefined;
    const schedule = departureYmd ? findDepartureScheduleForYmd(schedules, departureYmd) : null;
    const returnRaw = schedule?.returnDate?.trim();
    const returnDate = returnRaw
      ? normalizeProductDepartureDateToYmd(returnRaw) ?? returnRaw
      : departureYmd ?? null;

    const result = await createPendingDepositBooking({
      memberId: auth.session.memberId,
      productId: body.product_id,
      productTitle: body.product_title?.trim() || String(product.title ?? "상품"),
      sourcePath: body.source_path?.trim() || `/products/${body.product_id}`,
      departure: body.departure,
      selectedOptions: body.selected_options,
      options: (product.options as Record<string, unknown> | null)?.groups
        ? (product.options as import("@/types/product").ProductOptions)
        : undefined,
      productBasePrice: typeof product.price === "number" ? product.price : null,
      pointsUse: body.points_use,
      travelerCount: body.traveler_count,
      returnDate,
      benefitMode,
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
    if (message === "PORTONE_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: "결제 서비스가 아직 설정되지 않았습니다. 상담 문의로 예약해 주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
