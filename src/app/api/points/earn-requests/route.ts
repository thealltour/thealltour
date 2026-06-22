import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMemberSession } from "@/lib/apiAuth";
import { getStorageProvider } from "@/lib/storage";
import {
  MAX_ACTIVE_EARN_REQUESTS,
  MAX_EARN_ATTACHMENTS,
  MIN_EARN_ATTACHMENTS,
  parseEarnRequestShipping,
  parseTravelerCount,
  validateEarnRequestAttachment,
} from "@/server/services/points/earnRequests";

const EARN_REQUEST_LIST_FIELDS =
  "id, status, booking_ref, departure_date, payer_name, traveler_count, gift_status, shipping_name, shipping_phone, shipping_zip, shipping_address1, shipping_address2, memo, contact_phone, admin_memo, reject_reason, requested_at, decided_at";

function buildAttachmentPath(userId: string, fileName: string) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `points/earn-requests/${yyyy}/${mm}/${userId}/${Date.now()}-${safeName}`;
}

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { data, error } = await supabaseAdmin
    .from("point_earn_requests")
    .select(EARN_REQUEST_LIST_FIELDS)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "요청 목록을 불러올 수 없습니다." }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const bookingRefRaw = String(formData.get("booking_ref") ?? "").trim();
  const bookingIdRaw = String(formData.get("booking_id") ?? "").trim();
  const departureDate = String(formData.get("departure_date") ?? "").trim();
  const payerName = String(formData.get("payer_name") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const travelerCount = parseTravelerCount(formData.get("traveler_count"));
  const shippingParsed = parseEarnRequestShipping(formData);
  const files = formData.getAll("attachments").filter((v): v is File => v instanceof File);

  if (!bookingRefRaw || !departureDate || !payerName) {
    return NextResponse.json({ message: "booking_ref, departure_date, payer_name은 필수입니다." }, { status: 400 });
  }

  let bookingRef = bookingRefRaw;
  let bookingId: string | null = bookingIdRaw || null;

  if (bookingId) {
    const { data: booking, error: bookErr } = await supabaseAdmin
      .from("travel_bookings")
      .select("id, booking_number, booking_status, member_id, customer_profile_id, traveler_count, departure_date")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookErr || !booking) {
      return NextResponse.json({ message: "선택한 예약을 찾을 수 없습니다." }, { status: 400 });
    }

    const b = booking as Record<string, unknown>;
    if (b.booking_status !== "completed") {
      return NextResponse.json({ message: "여행 완료된 예약만 리워드 신청할 수 있습니다." }, { status: 400 });
    }

    bookingRef = String(b.booking_number);
    if (bookingRef !== bookingRefRaw) {
      return NextResponse.json({ message: "예약번호가 선택한 예약과 일치하지 않습니다." }, { status: 400 });
    }

    const { data: dupByBooking } = await supabaseAdmin
      .from("point_earn_requests")
      .select("id")
      .eq("booking_id", bookingId)
      .in("status", ["REQUESTED", "APPROVED"])
      .maybeSingle();
    if (dupByBooking) {
      return NextResponse.json({ message: "이 예약에 대한 적립 요청이 이미 있습니다." }, { status: 400 });
    }
  }
  if (travelerCount == null) {
    return NextResponse.json({ message: "여행 인원수는 1~99 사이 정수로 입력해 주세요." }, { status: 400 });
  }
  if (!shippingParsed.ok) {
    return NextResponse.json({ message: shippingParsed.message }, { status: 400 });
  }
  if (files.length < MIN_EARN_ATTACHMENTS || files.length > MAX_EARN_ATTACHMENTS) {
    return NextResponse.json({ message: "증빙 파일은 1~3개까지 업로드할 수 있습니다." }, { status: 400 });
  }

  for (const file of files) {
    const result = validateEarnRequestAttachment(file);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
  }

  const [activeRes, dupRes] = await Promise.all([
    supabaseAdmin
      .from("point_earn_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "REQUESTED"),
    supabaseAdmin
      .from("point_earn_requests")
      .select("id")
      .eq("booking_ref", bookingRef)
      .maybeSingle(),
  ]);

  if (activeRes.error || dupRes.error) {
    return NextResponse.json({ message: "중복/요청 상태 확인에 실패했습니다." }, { status: 500 });
  }
  if ((activeRes.count ?? 0) >= MAX_ACTIVE_EARN_REQUESTS) {
    return NextResponse.json({ message: "진행 중인 적립 요청이 있어 추가 요청할 수 없습니다." }, { status: 400 });
  }
  if (dupRes.data) {
    return NextResponse.json({ message: "이미 등록된 예약번호입니다." }, { status: 400 });
  }

  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("point_earn_requests")
    .insert({
      user_id: userId,
      booking_id: bookingId,
      status: "REQUESTED",
      booking_ref: bookingRef,
      departure_date: departureDate,
      payer_name: payerName,
      traveler_count: travelerCount,
      shipping_name: shippingParsed.shipping_name,
      shipping_phone: shippingParsed.shipping_phone,
      shipping_zip: shippingParsed.shipping_zip,
      shipping_address1: shippingParsed.shipping_address1,
      shipping_address2: shippingParsed.shipping_address2,
      memo: memo || null,
      contact_phone: contactPhone || null,
    })
    .select("id")
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ message: "적립 요청 생성에 실패했습니다." }, { status: 500 });
  }

  const requestId = (reqRow as { id: string }).id;
  const provider = getStorageProvider();

  try {
    const uploaded = [];
    for (const file of files) {
      const path = buildAttachmentPath(userId, file.name);
      const result = await provider.uploadPublicImage({
        file,
        path,
        contentType: file.type,
        bucket: process.env.POINT_EARN_REQUEST_BUCKET || "product-images",
      });
      uploaded.push({
        request_id: requestId,
        file_url: result.url,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
    }

    const { error: attachErr } = await supabaseAdmin.from("earn_request_attachments").insert(uploaded);
    if (attachErr) {
      await supabaseAdmin.from("point_earn_requests").delete().eq("id", requestId);
      return NextResponse.json({ message: "증빙 파일 저장에 실패했습니다." }, { status: 500 });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "ADMIN_MESSAGE",
      title: "포인트 적립 요청 접수",
      body: `예약 증빙 요청이 접수되었습니다. (${travelerCount}명, 인당 20,000P + 골프공 세트) 관리자 검수 후 처리됩니다.`,
    });

    return NextResponse.json({ id: requestId, message: "적립 요청이 접수되었습니다." }, { status: 201 });
  } catch (error) {
    await supabaseAdmin.from("point_earn_requests").delete().eq("id", requestId);
    const message = error instanceof Error ? error.message : "파일 업로드에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
